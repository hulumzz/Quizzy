import assert from 'node:assert/strict';
import test from 'node:test';
import { DiscussionRepository } from '../src/repositories/discussion-repository.js';

function materialRepository(accessRole = 'member') {
  return { async get(classId, materialId) { return { id: materialId, classId, title: 'Fotosintesis', status: 'published', accessRole }; } };
}

test('discussion list reconstructs replies and exposes only current-user edit permission', async () => {
  const documentClient = { async send() { return { Items: [
    { entityType: 'DISCUSSION', id: 'discussion-1', content: 'Pertanyaan', authorId: 'student-1', authorName: 'Rani', authorRole: 'student', status: 'resolved', answerId: 'reply-1', createdAt: '2026-09-23T01:00:00.000Z', updatedAt: '2026-09-23T01:00:00.000Z' },
    { entityType: 'DISCUSSION_REPLY', id: 'reply-1', discussionId: 'discussion-1', content: 'Jawaban', authorId: 'teacher-1', authorName: 'Ibu Nisa', authorRole: 'teacher', createdAt: '2026-09-23T02:00:00.000Z', updatedAt: '2026-09-23T02:00:00.000Z' },
  ] }; } };
  const repository = new DiscussionRepository({ tableName: 'QuizzyTest', documentClient, materialRepository: materialRepository() });
  const result = await repository.list('class-1', 'material-1', 'student-1');
  assert.equal(result.discussions[0].canEdit, true);
  assert.equal(result.discussions[0].replies[0].canEdit, false);
  assert.equal(result.discussions[0].replies[0].isAnswer, true);
});

test('discussion create derives the teacher marker from material access', async () => {
  let put;
  const documentClient = { async send(command) { put = command.input; return {}; } };
  const repository = new DiscussionRepository({ tableName: 'QuizzyTest', documentClient, materialRepository: materialRepository('owner') });
  const discussion = await repository.create({ classId: 'class-1', materialId: 'material-1', uid: 'teacher-1', authorName: 'Ibu Nisa', content: 'Catatan guru', now: '2026-09-23T00:00:00.000Z' });
  assert.equal(put.Item.PK, 'MATERIAL#material-1');
  assert.equal(put.Item.authorId, 'teacher-1');
  assert.equal(discussion.author.role, 'teacher');
});

test('only the message author can update a discussion', async () => {
  const documentClient = { async send() { return { Item: { authorId: 'student-2', content: 'Pesan', createdAt: '2026-09-23T00:00:00.000Z' } }; } };
  const repository = new DiscussionRepository({ tableName: 'QuizzyTest', documentClient, materialRepository: materialRepository() });
  await assert.rejects(() => repository.update({ classId: 'class-1', materialId: 'material-1', discussionId: 'discussion-1', uid: 'student-1', content: 'Ubah' }), (error) => error.statusCode === 403);
});

test('only the class owner can resolve a discussion', async () => {
  const repository = new DiscussionRepository({ tableName: 'QuizzyTest', documentClient: { async send() { return {}; } }, materialRepository: materialRepository('member') });
  await assert.rejects(() => repository.setStatus({ classId: 'class-1', materialId: 'material-1', discussionId: 'discussion-1', uid: 'student-1', status: 'resolved', answerId: null }), (error) => error.statusCode === 403);
});

test('deleting the selected answer atomically reopens its discussion', async () => {
  let calls = 0;
  let transaction;
  const documentClient = { async send(command) {
    calls += 1;
    if (calls === 1) return { Item: { id: 'reply-1', authorId: 'student-1', discussionId: 'discussion-1' } };
    if (calls === 2) return { Item: { id: 'discussion-1', answerId: 'reply-1', status: 'resolved' } };
    transaction = command.input;
    return {};
  } };
  const repository = new DiscussionRepository({ tableName: 'QuizzyTest', documentClient, materialRepository: materialRepository() });
  await repository.remove({ classId: 'class-1', materialId: 'material-1', discussionId: 'discussion-1', replyId: 'reply-1', uid: 'student-1', now: '2026-09-23T03:00:00.000Z' });
  assert.equal(transaction.TransactItems.length, 2);
  assert.equal(transaction.TransactItems[1].Update.ExpressionAttributeValues[':open'], 'open');
});

test('reopening a discussion does not send unused DynamoDB expression values', async () => {
  let calls = 0;
  let update;
  const documentClient = { async send(command) {
    calls += 1;
    if (calls === 1) return { Item: { id: 'discussion-1', status: 'resolved' } };
    update = command.input;
    return { Attributes: { status: 'open' } };
  } };
  const repository = new DiscussionRepository({ tableName: 'QuizzyTest', documentClient, materialRepository: materialRepository('owner') });
  await repository.setStatus({ classId: 'class-1', materialId: 'material-1', discussionId: 'discussion-1', uid: 'teacher-1', status: 'open', answerId: null, now: '2026-09-23T04:00:00.000Z' });
  assert.equal(update.ExpressionAttributeValues[':status'], 'open');
  assert.equal(':uid' in update.ExpressionAttributeValues, false);
});
