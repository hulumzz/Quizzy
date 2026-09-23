import assert from 'node:assert/strict';
import test from 'node:test';
import { LiveQuizRepository } from '../src/repositories/live-quiz-repository.js';

test('join rate limit stores only a hashed network key with a TTL', async () => {
  const calls = [];
  const repository = new LiveQuizRepository({
    tableName: 'QuizzyTable',
    quizRepository: {},
    documentClient: { async send(command) { calls.push(command); return {}; } },
  });
  await repository.limitJoin('203.0.113.42', new Date('2026-09-23T00:00:00.000Z'));
  const input = calls[0].input;
  assert.match(input.Key.PK, /^LIVE_RATE#[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(input.Key.PK, /203\.0\.113\.42/);
  assert.equal(input.Key.SK, `JOIN#${Math.floor(new Date('2026-09-23T00:00:00.000Z').getTime() / 60000)}`);
  assert.equal(input.ExpressionAttributeValues[':limit'], 30);
  assert.equal(input.ExpressionAttributeValues[':expiresAt'], Math.floor(new Date('2026-09-23T00:00:00.000Z').getTime() / 1000) + 3600);
});

test('queued answer transaction rechecks the active server state before storing an answer', async () => {
  const calls = [];
  const session = { PK: 'LIVE_SESSION#session-1', id: 'session-1', joinCode: 'AB2CDE', expiresAt: 2000000000, phase: 'question', currentQuestionIndex: 0, endsAt: '2026-09-23T00:01:00.000Z', questions: [{ id: 'q-1' }] };
  const repository = new LiveQuizRepository({
    tableName: 'QuizzyTable',
    quizRepository: {},
    documentClient: { async send(command) { calls.push(command); if (calls.length === 1) return { Item: session }; return {}; } },
  });
  await repository.processQueuedAnswer({ sessionId: 'session-1', participantId: 'participant-1', questionId: 'q-1', questionIndex: 0, answer: 'A', acceptedAt: '2026-09-23T00:00:30.000Z' });
  const transaction = calls[1].input.TransactItems;
  assert.equal(transaction[0].Update.ConditionExpression, '#phase = :phase AND currentQuestionIndex = :index AND endsAt >= :now');
  assert.equal(transaction[1].Put.Item.expiresAt, 2000000000);
});

test('only the reveal state exposes the correct answer to public quiz players', () => {
  const repository = new LiveQuizRepository({ tableName: 'QuizzyTable', quizRepository: {}, documentClient: {} });
  const base = { id: 'session-1', joinCode: 'AB2CDE', title: 'Kuis', currentQuestionIndex: 0, questions: [{ id: 'q-1', type: 'multiple_choice', prompt: 'Pilih', choices: ['A', 'B'], correctAnswer: 'A', explanation: 'Karena A', points: 1 }], stateVersion: 1 };
  assert.equal(repository.publicState({ ...base, phase: 'question' }).question.correctAnswer, undefined);
  assert.deepEqual(repository.publicState({ ...base, phase: 'reveal' }).question, { id: 'q-1', type: 'multiple_choice', prompt: 'Pilih', choices: ['A', 'B'], correctAnswer: 'A', explanation: 'Karena A', points: 1 });
});
