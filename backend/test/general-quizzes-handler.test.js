import assert from 'node:assert/strict';
import test from 'node:test';
import { createGeneralQuizzesHandler } from '../src/functions/general-quizzes/handler.js';

const request = (method, path, body) => ({ rawPath: path, body: body === undefined ? undefined : JSON.stringify(body), requestContext: { http: { method }, requestId: 'general-quiz-request' } });
const quizInput = { title: 'Kuis umum pertama', status: 'draft', questions: [], settings: { passingScore: 70 } };

function setup(identity = { uid: 'teacher-1', signInProvider: 'google.com' }) {
  const calls = []; const repository = {
    async list(ownerId) { calls.push(['list', ownerId]); return []; },
    async create(input) { calls.push(['create', input]); return { id: 'general-1', ...input }; },
    async get(ownerId, quizId) { calls.push(['get', ownerId, quizId]); return { id: quizId }; },
    async update(input) { calls.push(['update', input]); return input; },
    async remove(ownerId, quizId) { calls.push(['remove', ownerId, quizId]); },
  };
  return { calls, handler: createGeneralQuizzesHandler({ authenticate: async () => identity, repository, logger: { error() {} } }) };
}

test('general quiz endpoints derive the owner from verified identity', async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(request('GET', '/general-quizzes'))).statusCode, 200);
  assert.equal((await handler(request('POST', '/general-quizzes', { ...quizInput, ownerId: 'attacker' }))).statusCode, 201);
  assert.equal((await handler(request('PUT', '/general-quizzes/general-1', { ...quizInput, ownerId: 'attacker' }))).statusCode, 200);
  assert.deepEqual(calls[0], ['list', 'teacher-1']);
  assert.equal(calls[1][1].ownerId, 'teacher-1');
  assert.equal(calls[2][1].ownerId, 'teacher-1');
});

test('anonymous users cannot manage general quizzes', async () => {
  const { handler } = setup({ uid: 'guest', signInProvider: 'anonymous' });
  assert.equal((await handler(request('GET', '/general-quizzes'))).statusCode, 403);
});
