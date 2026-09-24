import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuizBankHandler } from '../src/functions/quiz-bank/handler.js';

const request = (method, path, body, queryStringParameters) => ({ rawPath: path, body: body === undefined ? undefined : JSON.stringify(body), queryStringParameters, requestContext: { http: { method }, requestId: 'bank-request' } });
function setup(identity = { uid: 'teacher-1', signInProvider: 'google.com' }) {
  const calls = []; const repository = {
    async list(input) { calls.push(['list', input]); return []; }, async listMine(uid) { calls.push(['mine', uid]); return []; }, async publish(input) { calls.push(['publish', input]); return { id: 'catalog-1' }; }, async copyToClass(input) { calls.push(['copy', input]); return { id: 'quiz-copy' }; }, async unpublish(input) { calls.push(['unpublish', input]); },
  };
  return { calls, handler: createQuizBankHandler({ authenticate: async () => identity, repository, logger: { error() {} } }) };
}

test('teacher can list taxonomy and publish a source quiz with server identity', async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(request('GET', '/quiz-bank/taxonomy'))).statusCode, 200);
  assert.equal((await handler(request('POST', '/quiz-bank/publish', { classId: 'class-1', quizId: 'quiz-1', level: 'sd', subjectId: 'matematika' }))).statusCode, 201);
  assert.equal(calls[0][0], 'publish');
  assert.equal(calls[0][1].ownerId, 'teacher-1');
});

test('bank copy validates destination class and derives teacher identity', async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(request('POST', '/quiz-bank/catalog-1/copy', { classId: 'class-2', ownerId: 'attacker' }))).statusCode, 201);
  assert.deepEqual(calls[0], ['copy', { catalogId: 'catalog-1', ownerId: 'teacher-1', classId: 'class-2' }]);
});
