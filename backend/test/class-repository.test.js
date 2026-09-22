import assert from 'node:assert/strict';
import test from 'node:test';
import { ClassRepository } from '../src/repositories/class-repository.js';

test('listOwnedBy queries only the verified owner index', async () => {
  let command;
  const documentClient = { async send(input) { command = input; return { Items: [] }; } };
  const repository = new ClassRepository({ tableName: 'QuizzyTest', documentClient });
  await repository.listOwnedBy('teacher-123');
  assert.equal(command.input.IndexName, 'OwnerIndex');
  assert.deepEqual(command.input.ExpressionAttributeValues, { ':owner': 'OWNER#teacher-123', ':entity': 'CLASS#' });
  assert.equal(command.input.ScanIndexForward, false);
});

test('create stores class ownership server-side and reserves a join code', async () => {
  let command;
  const documentClient = { async send(input) { command = input; return {}; } };
  const repository = new ClassRepository({ tableName: 'QuizzyTest', documentClient });
  const created = await repository.create({ ownerId: 'teacher-123', teacherName: 'Pak Ari', name: 'Kimia', description: '', now: '2026-09-22T00:00:00.000Z' });
  const [classWrite, codeWrite] = command.input.TransactItems;
  assert.equal(classWrite.Put.Item.ownerId, 'teacher-123');
  assert.equal(classWrite.Put.Item.GSI1PK, 'OWNER#teacher-123');
  assert.equal(codeWrite.Put.Item.classId, created.id);
  assert.match(created.code, /^[23456789A-HJ-NP-Z]{6}$/);
});

test('listJoinedBy resolves membership records to current class metadata', async () => {
  const commands = [];
  const documentClient = {
    async send(command) {
      commands.push(command);
      if (commands.length === 1) return { Items: [{ classId: 'class-1', joinedAt: '2026-09-23T02:00:00.000Z' }] };
      return { Responses: { QuizzyTest: [{ id: 'class-1', code: 'ABC234', name: 'Kimia', status: 'active' }] } };
    },
  };
  const repository = new ClassRepository({ tableName: 'QuizzyTest', documentClient });
  const classes = await repository.listJoinedBy('student-1');
  assert.equal(commands[0].input.ExpressionAttributeValues[':user'], 'USER#student-1');
  assert.deepEqual(commands[1].input.RequestItems.QuizzyTest.Keys, [{ PK: 'CLASS#class-1', SK: 'META' }]);
  assert.equal(classes[0].accessRole, 'member');
  assert.equal(classes[0].name, 'Kimia');
});

test('joinByCode atomically stores both membership views and increments the class count', async () => {
  const commands = [];
  const classItem = {
    id: 'class-1', code: 'ABC234', name: 'Kimia', ownerId: 'teacher-1', status: 'active', studentsCount: 2,
  };
  const documentClient = {
    async send(command) {
      commands.push(command);
      if (commands.length === 1) return { Item: { classId: 'class-1' } };
      if (commands.length === 2) return { Item: classItem };
      if (commands.length === 3) return {};
      return {};
    },
  };
  const repository = new ClassRepository({ tableName: 'QuizzyTest', documentClient });
  const joined = await repository.joinByCode({
    uid: 'student-1', name: 'Dina', code: 'ABC234', idempotencyKey: 'request-12345678', now: '2026-09-23T03:00:00.000Z',
  });
  const transaction = commands[3].input;
  assert.equal(transaction.ClientRequestToken, 'request-12345678');
  assert.equal(transaction.TransactItems[0].Put.Item.SK, 'MEMBER#student-1');
  assert.equal(transaction.TransactItems[1].Put.Item.PK, 'USER#student-1');
  assert.equal(transaction.TransactItems[2].Update.ExpressionAttributeValues[':one'], 1);
  assert.equal(joined.studentsCount, 3);
});

test('joinByCode is idempotent when membership already exists', async () => {
  let calls = 0;
  const documentClient = {
    async send() {
      calls += 1;
      if (calls === 1) return { Item: { classId: 'class-1' } };
      if (calls === 2) return { Item: { id: 'class-1', code: 'ABC234', ownerId: 'teacher-1', status: 'active' } };
      return { Item: { uid: 'student-1', joinedAt: '2026-09-23T03:00:00.000Z' } };
    },
  };
  const repository = new ClassRepository({ tableName: 'QuizzyTest', documentClient });
  const joined = await repository.joinByCode({ uid: 'student-1', name: 'Dina', code: 'ABC234' });
  assert.equal(calls, 3);
  assert.equal(joined.joinedAt, '2026-09-23T03:00:00.000Z');
});

test('getForUser requires ownership or a stored membership', async () => {
  let calls = 0;
  const documentClient = {
    async send() {
      calls += 1;
      if (calls === 1) return { Item: { id: 'class-1', ownerId: 'teacher-1', status: 'active' } };
      return {};
    },
  };
  const repository = new ClassRepository({ tableName: 'QuizzyTest', documentClient });
  await assert.rejects(() => repository.getForUser('class-1', 'outsider-1'), (error) => error.statusCode === 403);
});

test('getForUser grants the owner and a stored member their correct access role', async () => {
  let calls = 0;
  const documentClient = {
    async send() {
      calls += 1;
      if (calls === 1) return { Item: { id: 'class-1', ownerId: 'teacher-1', status: 'active' } };
      if (calls === 2) return { Item: { id: 'class-1', ownerId: 'teacher-1', status: 'active' } };
      return { Item: { uid: 'student-1', joinedAt: '2026-09-23T03:00:00.000Z' } };
    },
  };
  const repository = new ClassRepository({ tableName: 'QuizzyTest', documentClient });
  const ownerView = await repository.getForUser('class-1', 'teacher-1');
  const memberView = await repository.getForUser('class-1', 'student-1');
  assert.equal(ownerView.accessRole, 'owner');
  assert.equal(memberView.accessRole, 'member');
  assert.equal(memberView.joinedAt, '2026-09-23T03:00:00.000Z');
});

test('listMembers is restricted to the class owner', async () => {
  const documentClient = { async send() { return { Item: { id: 'class-1', ownerId: 'teacher-1' } }; } };
  const repository = new ClassRepository({ tableName: 'QuizzyTest', documentClient });
  await assert.rejects(() => repository.listMembers('class-1', 'student-1'), (error) => error.statusCode === 403);
});

test('listMembers returns only member records for the class owner', async () => {
  const commands = [];
  const documentClient = {
    async send(command) {
      commands.push(command);
      if (commands.length === 1) return { Item: { id: 'class-1', ownerId: 'teacher-1' } };
      return { Items: [{ uid: 'student-1', name: 'Dina', joinedAt: '2026-09-23T03:00:00.000Z' }] };
    },
  };
  const repository = new ClassRepository({ tableName: 'QuizzyTest', documentClient });
  const members = await repository.listMembers('class-1', 'teacher-1');
  assert.equal(commands[1].input.ExpressionAttributeValues[':class'], 'CLASS#class-1');
  assert.equal(commands[1].input.ExpressionAttributeValues[':member'], 'MEMBER#');
  assert.deepEqual(members, [{ uid: 'student-1', name: 'Dina', joinedAt: '2026-09-23T03:00:00.000Z' }]);
});
