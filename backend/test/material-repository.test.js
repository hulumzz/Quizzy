import assert from 'node:assert/strict';
import test from 'node:test';
import { MaterialRepository } from '../src/repositories/material-repository.js';

function classRepository(accessRole = 'owner') {
  return { async getForUser() { return { id: 'class-1', accessRole }; } };
}

test('student material list excludes drafts and includes learning state', async () => {
  let calls = 0;
  const documentClient = {
    async send() {
      calls += 1;
      if (calls === 1) return { Items: [
        { id: 'published-1', classId: 'class-1', title: 'Terbit', status: 'published', blocks: [], updatedAt: '2026-09-23T02:00:00.000Z' },
        { id: 'draft-1', classId: 'class-1', title: 'Draf', status: 'draft', blocks: [], updatedAt: '2026-09-23T03:00:00.000Z' },
      ] };
      if (calls === 2) return { Item: { percent: 50, status: 'started', lastReadAt: '2026-09-23T04:00:00.000Z' } };
      return {};
    },
  };
  const repository = new MaterialRepository({ tableName: 'QuizzyTest', documentClient, classRepository: classRepository('member') });
  const materials = await repository.list('class-1', 'student-1');
  assert.equal(materials.length, 1);
  assert.equal(materials[0].id, 'published-1');
  assert.equal(materials[0].progress.percent, 50);
});

test('create material uses a transaction to store content and increment the class count', async () => {
  let command;
  const documentClient = { async send(input) { command = input; return {}; } };
  const repository = new MaterialRepository({ tableName: 'QuizzyTest', documentClient, classRepository: classRepository('owner') });
  const material = await repository.create({ classId: 'class-1', ownerId: 'teacher-1', title: 'Kimia', summary: '', status: 'published', blocks: [], now: '2026-09-23T00:00:00.000Z' });
  assert.equal(command.input.TransactItems[0].Put.Item.ownerId, 'teacher-1');
  assert.equal(command.input.TransactItems[1].Update.ExpressionAttributeValues[':one'], 1);
  assert.equal(material.status, 'published');
  assert.equal(material.publishedAt, '2026-09-23T00:00:00.000Z');
});

test('students cannot create material', async () => {
  const repository = new MaterialRepository({ tableName: 'QuizzyTest', documentClient: { async send() { return {}; } }, classRepository: classRepository('member') });
  await assert.rejects(() => repository.create({ classId: 'class-1', ownerId: 'student-1', title: 'Tidak boleh', summary: '', status: 'draft', blocks: [] }), (error) => error.statusCode === 403);
});

test('progress requires class membership and writes a completed record', async () => {
  let calls = 0;
  let update;
  const documentClient = {
    async send(command) {
      calls += 1;
      if (calls === 1) return { Item: { id: 'material-1', status: 'published' } };
      update = command;
      return { Attributes: { percent: 100, status: 'completed', lastReadAt: '2026-09-23T00:00:00.000Z', completedAt: '2026-09-23T00:00:00.000Z' } };
    },
  };
  const repository = new MaterialRepository({ tableName: 'QuizzyTest', documentClient, classRepository: classRepository('member') });
  const progress = await repository.setProgress({ classId: 'class-1', materialId: 'material-1', uid: 'student-1', percent: 100, now: '2026-09-23T00:00:00.000Z' });
  assert.equal(update.input.Key.PK, 'USER#student-1');
  assert.match(update.input.Key.SK, /^PROGRESS#CLASS#class-1#/);
  assert.equal(progress.status, 'completed');
});
