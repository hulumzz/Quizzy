import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveQuizzesHandler } from '../src/functions/live-quizzes/handler.js';

function request(method, path, body) {
  return { rawPath: path, body: body === undefined ? undefined : JSON.stringify(body), requestContext: { http: { method }, requestId: 'live-request' } };
}

function setup(identity = { uid: 'teacher-1', signInProvider: 'google.com' }) {
  const calls = [];
  const repository = {
    async publicStateByCode(code) { calls.push(['public', code]); return { code }; },
    async join(input) { calls.push(['join', input]); return { participant: { id: 'participant-1' } }; },
    async answer(input) { calls.push(['answer', input]); return { accepted: true }; },
    async authorizeAnswer(input) { calls.push(['authorize', input]); return { sessionId: 'session-1', participantId: input.participantId, questionId: input.questionId, questionIndex: 0, answer: input.answer, acceptedAt: '2026-09-23T00:00:00.000Z' }; },
    async participantResult(input) { calls.push(['result', input]); return { participant: { id: input.participantId, score: 10, rank: 1 } }; },
    async create(input) { calls.push(['create', input]); return { id: 'session-1' }; },
    async hostStateById(id, ownerId) { calls.push(['host', id, ownerId]); return { id }; },
    async advance(input) { calls.push(['advance', input]); return { id: input.sessionId }; },
  };
  const answerQueue = { async enqueue(input) { calls.push(['enqueue', input]); return { accepted: true, acceptedAt: input.acceptedAt }; } };
  return { calls, handler: createLiveQuizzesHandler({ authenticate: async () => identity, repository, answerQueue, logger: { error() {} } }) };
}

test('public live join does not invoke authentication and uses a validated code', async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(request('GET', '/live-quizzes/ab2cde'))).statusCode, 200);
  assert.equal((await handler(request('POST', '/live-quizzes/ab2cde/join', { name: 'Dina' }))).statusCode, 201);
  assert.deepEqual(calls[0], ['public', 'AB2CDE']);
  assert.deepEqual(calls[1], ['join', { joinCode: 'AB2CDE', sourceIp: 'unknown', name: 'Dina' }]);
});

test('host session actions derive owner identity from the verified token', async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(request('POST', '/classes/class-1/quizzes/quiz-1/live-sessions', { questionDurationSeconds: 45 }))).statusCode, 201);
  assert.equal((await handler(request('POST', '/classes/class-1/live-sessions/session-1/action', { action: 'advance', ownerId: 'attacker' }))).statusCode, 200);
  assert.equal(calls[0][1].ownerId, 'teacher-1');
  assert.equal(calls[1][1].ownerId, 'teacher-1');
});

test('public answers are authorized before being queued', async () => {
  const { calls, handler } = setup();
  const token = 'a'.repeat(64);
  assert.equal((await handler(request('POST', '/live-quizzes/ab2cde/answer', { participantId: 'participant-1', participantToken: token, questionId: 'q-1', answer: 'A' }))).statusCode, 202);
  assert.equal(calls[0][0], 'authorize');
  assert.equal(calls[1][0], 'enqueue');
  assert.equal(calls[1][1].participantToken, undefined);
});

test('participant result is private to the holder of a valid participant session', async () => {
  const { calls, handler } = setup();
  const token = 'a'.repeat(64);
  assert.equal((await handler(request('POST', '/live-quizzes/ab2cde/result', { participantId: 'participant-1', participantToken: token }))).statusCode, 200);
  assert.deepEqual(calls[0], ['result', { joinCode: 'AB2CDE', participantId: 'participant-1', participantToken: token }]);
});
