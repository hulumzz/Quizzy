import assert from 'node:assert/strict';
import test from 'node:test';
import { LearningSessionRepository } from '../src/repositories/learning-session-repository.js';

const classRepository = {
  async getForUser(classId, uid) {
    return { id: classId, accessRole: uid === 'teacher-1' ? 'owner' : 'member' };
  },
};

test('students only receive published learning sessions in configured order', async () => {
  const pages = [
    {
      Items: [
        { entityType: 'LEARNING_SESSION', id: 'draft-1', classId: 'class-1', ownerId: 'teacher-1', title: 'Draft', description: '', meetingDate: '2026-09-26', status: 'draft', sortOrder: 2000, createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' },
        { entityType: 'LEARNING_SESSION', id: 'published-2', classId: 'class-1', ownerId: 'teacher-1', title: 'Kedua', description: '', meetingDate: '2026-09-27', status: 'published', sortOrder: 2000, createdAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z' },
        { entityType: 'LEARNING_SESSION', id: 'published-1', classId: 'class-1', ownerId: 'teacher-1', title: 'Pertama', description: '', meetingDate: '2026-09-25', status: 'published', sortOrder: 1000, createdAt: '2026-09-19T00:00:00.000Z', updatedAt: '2026-09-19T00:00:00.000Z' },
      ],
    },
  ];
  const repository = new LearningSessionRepository({
    tableName: 'QuizzyTable',
    classRepository,
    documentClient: { async send() { return pages.shift(); } },
  });

  const sessions = await repository.list('class-1', 'student-1');
  assert.deepEqual(sessions.map((item) => item.id), ['published-1', 'published-2']);
  assert.ok(sessions.every((item) => item.accessRole === 'member'));
});

test('archived learning session cannot receive new linked content', async () => {
  const repository = new LearningSessionRepository({
    tableName: 'QuizzyTable',
    classRepository,
    documentClient: {
      async send() {
        return {
          Item: {
            entityType: 'LEARNING_SESSION',
            id: 'session-1',
            classId: 'class-1',
            ownerId: 'teacher-1',
            title: 'Arsip',
            description: '',
            meetingDate: '2026-09-25',
            status: 'archived',
            sortOrder: 1000,
            createdAt: '2026-09-20T00:00:00.000Z',
            updatedAt: '2026-09-20T00:00:00.000Z',
          },
        };
      },
    },
  });

  await assert.rejects(
    repository.requireAssignable('class-1', 'session-1', 'teacher-1'),
    (error) => error?.code === 'SESSION_ARCHIVED',
  );
});

test('reorder writes deterministic positions after verifying current sessions', async () => {
  const calls = [];
  const repository = new LearningSessionRepository({
    tableName: 'QuizzyTable',
    classRepository,
    documentClient: {
      async send(command) {
        calls.push(command);
        if (calls.length === 1) {
          return {
            Items: [
              { entityType: 'LEARNING_SESSION', id: 'session-a', classId: 'class-1', ownerId: 'teacher-1', title: 'A', description: '', meetingDate: '2026-09-25', status: 'draft', sortOrder: 1000, createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' },
              { entityType: 'LEARNING_SESSION', id: 'session-b', classId: 'class-1', ownerId: 'teacher-1', title: 'B', description: '', meetingDate: '2026-09-26', status: 'published', sortOrder: 2000, createdAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z' },
            ],
          };
        }
        if (calls.length === 2) return {};
        return {
          Items: [
            { entityType: 'LEARNING_SESSION', id: 'session-b', classId: 'class-1', ownerId: 'teacher-1', title: 'B', description: '', meetingDate: '2026-09-26', status: 'published', sortOrder: 1000, createdAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z' },
            { entityType: 'LEARNING_SESSION', id: 'session-a', classId: 'class-1', ownerId: 'teacher-1', title: 'A', description: '', meetingDate: '2026-09-25', status: 'draft', sortOrder: 2000, createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' },
          ],
        };
      },
    },
  });

  const sessions = await repository.reorder({
    classId: 'class-1',
    ownerId: 'teacher-1',
    sessionIds: ['session-b', 'session-a'],
    now: '2026-09-24T10:00:00.000Z',
  });
  const transaction = calls[1].input.TransactItems;
  assert.equal(transaction[0].Update.ExpressionAttributeValues[':order'], 1000);
  assert.equal(transaction[1].Update.ExpressionAttributeValues[':order'], 2000);
  assert.deepEqual(sessions.map((item) => item.id), ['session-b', 'session-a']);
});


test('reorder rejects stale or partial learning session lists', async () => {
  const repository = new LearningSessionRepository({
    tableName: 'QuizzyTable',
    classRepository,
    documentClient: {
      async send() {
        return {
          Items: [
            { entityType: 'LEARNING_SESSION', id: 'session-a', classId: 'class-1', ownerId: 'teacher-1', title: 'A', description: '', meetingDate: '2026-09-25', status: 'draft', sortOrder: 1000, createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' },
            { entityType: 'LEARNING_SESSION', id: 'session-b', classId: 'class-1', ownerId: 'teacher-1', title: 'B', description: '', meetingDate: '2026-09-26', status: 'published', sortOrder: 2000, createdAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z' },
          ],
        };
      },
    },
  });

  await assert.rejects(
    repository.reorder({ classId: 'class-1', ownerId: 'teacher-1', sessionIds: ['session-a'] }),
    (error) => error?.code === 'SESSION_ORDER_CHANGED',
  );
});
