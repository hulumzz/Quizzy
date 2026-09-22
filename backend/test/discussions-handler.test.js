import assert from 'node:assert/strict';
import test from 'node:test';
import { createDiscussionsHandler } from '../src/functions/discussions/handler.js';

function event(method, path, body) {
  return { rawPath: path, body: body === undefined ? undefined : JSON.stringify(body), requestContext: { http: { method }, requestId: 'request-discussion' } };
}

function setup(identity = { uid: 'student-1', name: 'Rani', email: 'rani@example.com', signInProvider: 'password' }) {
  const calls = [];
  const repository = {
    async list(...args) { calls.push(['list', ...args]); return { material: {}, discussions: [] }; },
    async create(input) { calls.push(['create', input]); return { id: 'discussion-1', ...input }; },
    async reply(input) { calls.push(['reply', input]); return { id: 'reply-1', ...input }; },
    async update(input) { calls.push(['update', input]); return input; },
    async remove(input) { calls.push(['remove', input]); },
    async setStatus(input) { calls.push(['status', input]); return input; },
  };
  return { calls, handler: createDiscussionsHandler({ authenticate: async () => identity, repository, logger: { error() {} } }) };
}

const base = '/classes/class-1/materials/material-1/discussions';

test('discussion collection lists and creates with verified identity', async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(event('GET', base))).statusCode, 200);
  assert.equal((await handler(event('POST', base, { content: ' Pertanyaan saya ' }))).statusCode, 201);
  assert.deepEqual(calls[0], ['list', 'class-1', 'material-1', 'student-1']);
  assert.equal(calls[1][1].uid, 'student-1');
  assert.equal(calls[1][1].authorName, 'Rani');
});

test('reply, update, delete, and resolved routes map to repository operations', async () => {
  const { calls, handler } = setup({ uid: 'teacher-1', name: 'Ibu Nisa', signInProvider: 'google.com' });
  assert.equal((await handler(event('POST', `${base}/discussion-1/replies`, { content: 'Jawaban' }))).statusCode, 201);
  assert.equal((await handler(event('PUT', `${base}/discussion-1/replies/reply-1`, { content: 'Jawaban diperbarui' }))).statusCode, 200);
  assert.equal((await handler(event('DELETE', `${base}/discussion-1`))).statusCode, 204);
  assert.equal((await handler(event('PUT', `${base}/discussion-1/status`, { status: 'resolved', answerId: 'reply-1' }))).statusCode, 200);
  assert.deepEqual(calls.map(([name]) => name), ['reply', 'update', 'remove', 'status']);
});

test('anonymous discussion access is rejected', async () => {
  const { handler } = setup({ uid: 'guest-1', signInProvider: 'anonymous' });
  assert.equal((await handler(event('GET', base))).statusCode, 403);
});
