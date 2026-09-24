import assert from 'node:assert/strict';
import test from 'node:test';
import { LiveQuizRepository } from '../src/repositories/live-quiz-repository.js';

test('general live session loads the owner quiz without requiring a class membership', async () => {
  const calls = [];
  const repository = new LiveQuizRepository({
    tableName: 'QuizzyTable',
    quizRepository: { async requireOwner() { throw new Error('class access must not be used'); } },
    generalQuizRepository: { async get(ownerId, quizId) { assert.equal(ownerId, 'teacher-1'); assert.equal(quizId, 'quiz-1'); return { id: quizId, ownerId, status: 'published', title: 'Kuis umum', questions: [{ id: 'q-1', points: 1 }] }; } },
    documentClient: { async send(command) { calls.push(command); return {}; } },
  });
  const session = await repository.create({ scope: 'general', ownerId: 'teacher-1', quizId: 'quiz-1', questionDurationSeconds: 30, now: '2026-09-24T00:00:00.000Z' });
  assert.equal(session.title, 'Kuis umum');
  assert.equal(calls[0].input.TransactItems[0].Put.Item.scope, 'general');
  assert.equal(calls[0].input.TransactItems[0].Put.Item.classId, undefined);
});
