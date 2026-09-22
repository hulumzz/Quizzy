import assert from 'node:assert/strict';
import test from 'node:test';
import { createMaterialsHandler } from '../src/functions/materials/handler.js';

function event(method, path, body) {
  return { rawPath: path, body: body === undefined ? undefined : JSON.stringify(body), requestContext: { http: { method }, requestId: 'request-material' } };
}

function setup(identity = { uid: 'teacher-1', name: 'Ibu Nisa', signInProvider: 'google.com' }) {
  const calls = [];
  const repository = {
    async list(classId, uid) { calls.push(['list', classId, uid]); return []; },
    async create(input) { calls.push(['create', input]); return { id: 'material-1', ...input }; },
    async get(classId, materialId, uid) { calls.push(['get', classId, materialId, uid]); return { id: materialId, classId }; },
    async update(input) { calls.push(['update', input]); return { id: input.materialId, ...input }; },
    async remove(classId, materialId, uid) { calls.push(['remove', classId, materialId, uid]); },
    async setProgress(input) { calls.push(['progress', input]); return { percent: input.percent, status: 'completed' }; },
    async setBookmark(input) { calls.push(['bookmark', input]); return { bookmarked: input.saved }; },
    async listUserState(uid, kind) { calls.push(['state', uid, kind]); return []; },
  };
  return { calls, handler: createMaterialsHandler({ authenticate: async () => identity, repository, logger: { error() {} } }) };
}

const input = { title: 'Materi pertama', summary: '', status: 'draft', blocks: [{ id: 'block-1', type: 'paragraph', content: 'Isi materi.' }] };

test('material collection lists with verified identity and creates with server ownership', async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(event('GET', '/classes/class-1/materials'))).statusCode, 200);
  const response = await handler(event('POST', '/classes/class-1/materials', { ...input, ownerId: 'attacker' }));
  assert.equal(response.statusCode, 201);
  assert.deepEqual(calls[0], ['list', 'class-1', 'teacher-1']);
  assert.equal(calls[1][1].ownerId, 'teacher-1');
});

test('material progress and bookmark operations use verified student identity', async () => {
  const { calls, handler } = setup({ uid: 'student-1', signInProvider: 'google.com' });
  assert.equal((await handler(event('PUT', '/classes/class-1/materials/material-1/progress', { percent: 100 }))).statusCode, 200);
  assert.equal((await handler(event('PUT', '/classes/class-1/materials/material-1/bookmark'))).statusCode, 200);
  assert.equal((await handler(event('DELETE', '/classes/class-1/materials/material-1/bookmark'))).statusCode, 200);
  assert.equal(calls[0][1].uid, 'student-1');
  assert.equal(calls[1][1].saved, true);
  assert.equal(calls[2][1].saved, false);
});

test('global learning lists and anonymous rejection have explicit responses', async () => {
  const { calls, handler } = setup({ uid: 'student-1', signInProvider: 'google.com' });
  assert.equal((await handler(event('GET', '/learning/bookmarks'))).statusCode, 200);
  assert.equal((await handler(event('GET', '/learning/progress'))).statusCode, 200);
  assert.deepEqual(calls, [['state', 'student-1', 'bookmarks'], ['state', 'student-1', 'progress']]);

  const anonymous = setup({ uid: 'guest-1', signInProvider: 'anonymous' });
  assert.equal((await anonymous.handler(event('GET', '/classes/class-1/materials'))).statusCode, 403);
});
