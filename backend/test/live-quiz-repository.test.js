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


test('authorized live answer captures the original question deadline for asynchronous processing', async () => {
  const session = {
    PK: 'LIVE_SESSION#session-1',
    id: 'session-1',
    phase: 'question',
    currentQuestionIndex: 0,
    endsAt: '2026-09-23T00:01:00.000Z',
    questions: [{ id: 'q-1' }],
  };
  const repository = new LiveQuizRepository({
    tableName: 'QuizzyTable',
    quizRepository: {},
    documentClient: { async send() { return { Item: { participantToken: 'secret' } }; } },
  });
  repository.getByCode = async () => session;
  const accepted = await repository.authorizeAnswer({
    joinCode: 'AB2CDE',
    participantId: 'participant-1',
    participantToken: 'secret',
    questionId: 'q-1',
    answer: 'A',
    now: '2026-09-23T00:00:30.000Z',
  });
  assert.equal(accepted.questionEndsAt, '2026-09-23T00:01:00.000Z');
  assert.equal(accepted.acceptedAt, '2026-09-23T00:00:30.000Z');
});

test('queued answer aggregates against the same active or reveal question before storing an answer', async () => {
  const calls = [];
  const session = { PK: 'LIVE_SESSION#session-1', id: 'session-1', joinCode: 'AB2CDE', expiresAt: 2000000000, phase: 'question', currentQuestionIndex: 0, endsAt: '2026-09-23T00:01:00.000Z', questions: [{ id: 'q-1' }] };
  const repository = new LiveQuizRepository({
    tableName: 'QuizzyTable',
    quizRepository: {},
    documentClient: { async send(command) { calls.push(command); if (calls.length === 1) return { Item: session }; return {}; } },
  });
  await repository.processQueuedAnswer({ sessionId: 'session-1', participantId: 'participant-1', questionId: 'q-1', questionIndex: 0, answer: 'A', acceptedAt: '2026-09-23T00:00:30.000Z' });
  const transaction = calls[1].input.TransactItems;
  assert.equal(transaction[0].Update.ConditionExpression, 'currentQuestionIndex = :index AND #phase IN (:question, :reveal)');
  assert.equal(transaction[1].Put.Item.expiresAt, 2000000000);
  assert.equal(transaction[1].Put.Item.correct, false);
  assert.equal(transaction[1].Put.Item.earnedPoints, 0);
  assert.match(transaction[2].Update.UpdateExpression, /ADD score :points, correctCount :correct/);
});

test('queued answer scores a correct answer on the server before it is persisted', async () => {
  const calls = [];
  const session = { PK: 'LIVE_SESSION#session-1', id: 'session-1', joinCode: 'AB2CDE', expiresAt: 2000000000, phase: 'question', currentQuestionIndex: 0, endsAt: '2026-09-23T00:01:00.000Z', questions: [{ id: 'q-1', type: 'multiple_choice', choices: ['A', 'B'], correctAnswer: 'B', points: 25 }] };
  const repository = new LiveQuizRepository({ tableName: 'QuizzyTable', quizRepository: {}, documentClient: { async send(command) { calls.push(command); if (calls.length === 1) return { Item: session }; return {}; } } });
  await repository.processQueuedAnswer({ sessionId: 'session-1', participantId: 'participant-1', questionId: 'q-1', questionIndex: 0, answer: 'B', acceptedAt: '2026-09-23T00:00:30.000Z' });
  const transaction = calls[1].input.TransactItems;
  assert.equal(transaction[0].Update.ExpressionAttributeValues[':correct'], 1);
  assert.equal(transaction[1].Put.Item.correct, true);
  assert.equal(transaction[1].Put.Item.earnedPoints, 25);
  assert.equal(transaction[2].Update.ExpressionAttributeValues[':points'], 25);
});

test('only the reveal state exposes the correct answer to public quiz players', () => {
  const repository = new LiveQuizRepository({ tableName: 'QuizzyTable', quizRepository: {}, documentClient: {} });
  const base = { id: 'session-1', joinCode: 'AB2CDE', title: 'Kuis', currentQuestionIndex: 0, questions: [{ id: 'q-1', type: 'multiple_choice', prompt: 'Pilih', choices: ['A', 'B'], correctAnswer: 'A', explanation: 'Karena A', points: 1 }], stateVersion: 1 };
  assert.equal(repository.publicState({ ...base, phase: 'question' }).question.correctAnswer, undefined);
  assert.deepEqual(repository.publicState({ ...base, phase: 'reveal' }).question, { id: 'q-1', type: 'multiple_choice', prompt: 'Pilih', choices: ['A', 'B'], correctAnswer: 'A', explanation: 'Karena A', points: 1 });
});


test('queued answer accepted before the deadline is still scored after the host advances to the next question', async () => {
  const calls = [];
  const session = {
    PK: 'LIVE_SESSION#session-1',
    id: 'session-1',
    expiresAt: 2000000000,
    phase: 'question',
    currentQuestionIndex: 1,
    endsAt: '2026-09-23T00:02:00.000Z',
    questions: [
      { id: 'q-1', type: 'multiple_choice', choices: ['A', 'B'], correctAnswer: 'B', points: 25 },
      { id: 'q-2', type: 'multiple_choice', choices: ['C', 'D'], correctAnswer: 'C', points: 10 },
    ],
  };
  const repository = new LiveQuizRepository({
    tableName: 'QuizzyTable',
    quizRepository: {},
    documentClient: { async send(command) { calls.push(command); if (calls.length === 1) return { Item: session }; return {}; } },
  });
  await repository.processQueuedAnswer({
    sessionId: 'session-1',
    participantId: 'participant-1',
    questionId: 'q-1',
    questionIndex: 0,
    answer: 'B',
    acceptedAt: '2026-09-23T00:00:30.000Z',
    questionEndsAt: '2026-09-23T00:01:00.000Z',
  });
  const transaction = calls[1].input.TransactItems;
  assert.equal(transaction.length, 2);
  assert.equal(transaction[0].Put.Item.questionId, 'q-1');
  assert.equal(transaction[0].Put.Item.correct, true);
  assert.equal(transaction[0].Put.Item.earnedPoints, 25);
  assert.equal(transaction[1].Update.ExpressionAttributeValues[':points'], 25);
});

test('queued answer retries without current-question aggregates if the host changes phase during the transaction', async () => {
  const calls = [];
  const session = {
    PK: 'LIVE_SESSION#session-1',
    id: 'session-1',
    expiresAt: 2000000000,
    phase: 'question',
    currentQuestionIndex: 0,
    endsAt: '2026-09-23T00:01:00.000Z',
    questions: [{ id: 'q-1', type: 'multiple_choice', choices: ['A', 'B'], correctAnswer: 'A', points: 5 }],
  };
  const repository = new LiveQuizRepository({
    tableName: 'QuizzyTable',
    quizRepository: {},
    documentClient: {
      async send(command) {
        calls.push(command);
        if (calls.length === 1) return { Item: session };
        if (calls.length === 2) {
          const error = new Error('phase changed');
          error.name = 'TransactionCanceledException';
          throw error;
        }
        if (calls.length === 3) return { Item: { ...session, currentQuestionIndex: 1, phase: 'question' } };
        return {};
      },
    },
  });
  await repository.processQueuedAnswer({
    sessionId: 'session-1',
    participantId: 'participant-1',
    questionId: 'q-1',
    questionIndex: 0,
    answer: 'A',
    acceptedAt: '2026-09-23T00:00:30.000Z',
    questionEndsAt: '2026-09-23T00:01:00.000Z',
  });
  assert.equal(calls[1].input.TransactItems.length, 3);
  assert.equal(calls[3].input.TransactItems.length, 2);
  assert.equal(calls[3].input.TransactItems[0].Put.Item.correct, true);
});


test('queued answer keeps transient DynamoDB transaction cancellations retryable for SQS', async () => {
  const calls = [];
  const session = {
    PK: 'LIVE_SESSION#session-1',
    id: 'session-1',
    expiresAt: 2000000000,
    phase: 'question',
    currentQuestionIndex: 0,
    endsAt: '2026-09-23T00:01:00.000Z',
    questions: [{ id: 'q-1', type: 'multiple_choice', choices: ['A', 'B'], correctAnswer: 'A', points: 5 }],
  };
  const repository = new LiveQuizRepository({
    tableName: 'QuizzyTable',
    quizRepository: {},
    documentClient: {
      async send(command) {
        calls.push(command);
        if (calls.length === 1) return { Item: session };
        if (calls.length === 2) {
          const error = new Error('capacity pressure');
          error.name = 'TransactionCanceledException';
          throw error;
        }
        if (calls.length === 3) return { Item: session };
        return {};
      },
    },
  });

  await assert.rejects(
    repository.processQueuedAnswer({
      sessionId: 'session-1',
      participantId: 'participant-1',
      questionId: 'q-1',
      questionIndex: 0,
      answer: 'A',
      acceptedAt: '2026-09-23T00:00:30.000Z',
      questionEndsAt: '2026-09-23T00:01:00.000Z',
    }),
    (error) => error?.name === 'TransactionCanceledException',
  );
  assert.equal(calls.length, 4);
  assert.equal(calls[3].input.Key.SK, 'ANSWER#q-1#participant-1');
});

test('queued answer treats a persisted answer as an idempotent duplicate after a cancelled transaction', async () => {
  const calls = [];
  const session = {
    PK: 'LIVE_SESSION#session-1',
    id: 'session-1',
    expiresAt: 2000000000,
    phase: 'question',
    currentQuestionIndex: 0,
    endsAt: '2026-09-23T00:01:00.000Z',
    questions: [{ id: 'q-1', type: 'multiple_choice', choices: ['A', 'B'], correctAnswer: 'A', points: 5 }],
  };
  const repository = new LiveQuizRepository({
    tableName: 'QuizzyTable',
    quizRepository: {},
    documentClient: {
      async send(command) {
        calls.push(command);
        if (calls.length === 1) return { Item: session };
        if (calls.length === 2) {
          const error = new Error('transaction cancelled');
          error.name = 'TransactionCanceledException';
          throw error;
        }
        if (calls.length === 3) return { Item: session };
        return { Item: { PK: session.PK, SK: 'ANSWER#q-1#participant-1' } };
      },
    },
  });

  await assert.rejects(
    repository.processQueuedAnswer({
      sessionId: 'session-1',
      participantId: 'participant-1',
      questionId: 'q-1',
      questionIndex: 0,
      answer: 'A',
      acceptedAt: '2026-09-23T00:00:30.000Z',
      questionEndsAt: '2026-09-23T00:01:00.000Z',
    }),
    (error) => error?.code === 'LIVE_ANSWER_ALREADY_RECEIVED',
  );
  assert.equal(calls.length, 4);
});


test('live participant listing follows DynamoDB pagination so leaderboard is not capped at 100', async () => {
  const calls = [];
  const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: `p-${index + 1}`, name: `P${index + 1}`, joinedAt: '2026-09-23T00:00:00.000Z' }));
  const secondPage = [{ id: 'p-101', name: 'P101', joinedAt: '2026-09-23T00:00:01.000Z' }];
  const repository = new LiveQuizRepository({
    tableName: 'QuizzyTable',
    quizRepository: {},
    documentClient: {
      async send(command) {
        calls.push(command);
        if (calls.length === 1) return { Items: firstPage, LastEvaluatedKey: { PK: 'LIVE_SESSION#session-1', SK: 'PARTICIPANT#p-100' } };
        return { Items: secondPage };
      },
    },
  });

  const participants = await repository.listParticipants({ PK: 'LIVE_SESSION#session-1' });
  assert.equal(participants.length, 101);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].input.Limit, 100);
  assert.equal(calls[0].input.ExclusiveStartKey, undefined);
  assert.deepEqual(calls[1].input.ExclusiveStartKey, { PK: 'LIVE_SESSION#session-1', SK: 'PARTICIPANT#p-100' });
});
