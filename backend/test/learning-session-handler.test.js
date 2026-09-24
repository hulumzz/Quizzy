import assert from 'node:assert/strict';
import test from 'node:test';
import { createLearningSessionsHandler } from '../src/functions/learning-sessions/handler.js';

const event = (method, path, body) => ({
  rawPath: path,
  requestContext: { http: { method } },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('learning sessions handler exposes collection and reorder operations', async () => {
  const calls = [];
  const repository = {
    async list(classId, uid) {
      calls.push(['list', classId, uid]);
      return [{ id: 'session-1' }];
    },
    async reorder(input) {
      calls.push(['reorder', input]);
      return [{ id: 'session-2' }, { id: 'session-1' }];
    },
  };
  const handler = createLearningSessionsHandler({
    authenticate: async () => ({ uid: 'teacher-1', signInProvider: 'password' }),
    repository,
    logger: { error() {} },
  });

  const listResponse = await handler(event('GET', '/classes/class-1/sessions'));
  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(listResponse.body).data.sessions, [{ id: 'session-1' }]);

  const reorderResponse = await handler(event('PUT', '/classes/class-1/sessions/reorder', {
    sessionIds: ['session-2', 'session-1'],
  }));
  assert.equal(reorderResponse.statusCode, 200);
  assert.equal(calls[1][0], 'reorder');
  assert.deepEqual(calls[1][1].sessionIds, ['session-2', 'session-1']);
});

test('learning sessions handler does not reinterpret reorder as a detail endpoint', async () => {
  const handler = createLearningSessionsHandler({
    authenticate: async () => ({ uid: 'teacher-1', signInProvider: 'password' }),
    repository: { async get() { throw new Error('detail route should not be used'); } },
    logger: { error() {} },
  });

  const response = await handler(event('GET', '/classes/class-1/sessions/reorder'));
  assert.equal(response.statusCode, 405);
});
