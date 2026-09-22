import assert from 'node:assert/strict';
import test from 'node:test';
import { createClassesHandler } from '../src/functions/classes/handler.js';

function event(method, body, path = '/classes', options = {}) {
  return {
    rawPath: path,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: options.headers,
    queryStringParameters: options.query,
    requestContext: { http: { method }, requestId: 'request-test' },
  };
}

function setup({ identity = { uid: 'user-1', name: 'Ibu Nisa', signInProvider: 'google.com' } } = {}) {
  const calls = [];
  const repository = {
    async listOwnedBy(uid) {
      calls.push(['list', uid]);
      return [{ id: 'class-1', name: 'Biologi' }];
    },
    async listJoinedBy(uid) {
      calls.push(['list-joined', uid]);
      return [{ id: 'class-joined', name: 'Kimia' }];
    },
    async create(input) {
      calls.push(['create', input]);
      return { id: 'class-2', code: 'ABC234', ...input };
    },
    async joinByCode(input) {
      calls.push(['join', input]);
      return { id: 'class-3', code: input.code, name: 'Matematika' };
    },
    async getForUser(classId, uid) {
      calls.push(['detail', classId, uid]);
      return { id: classId, name: 'Matematika', accessRole: 'member' };
    },
    async listMembers(classId, uid) {
      calls.push(['members', classId, uid]);
      return [{ uid: 'student-1', name: 'Dina' }];
    },
  };
  const logger = { error() {} };
  return {
    calls,
    handler: createClassesHandler({ authenticate: async () => identity, repository, logger }),
  };
}

test('GET /classes scopes the query to the verified uid', async () => {
  const { handler, calls } = setup();
  const response = await handler(event('GET'), { awsRequestId: 'aws-1' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [['list', 'user-1']]);
  assert.deepEqual(JSON.parse(response.body).data.classes, [{ id: 'class-1', name: 'Biologi' }]);
});

test('POST /classes ignores browser ownership and uses verified identity', async () => {
  const { handler, calls } = setup();
  const response = await handler(event('POST', { name: '  Fisika   Dasar ', description: 'Gelombang', ownerId: 'attacker' }));
  assert.equal(response.statusCode, 201);
  assert.equal(calls[0][1].ownerId, 'user-1');
  assert.equal(calls[0][1].name, 'Fisika Dasar');
  assert.equal(calls[0][1].teacherName, 'Ibu Nisa');
});

test('POST /classes rejects anonymous accounts', async () => {
  const { handler, calls } = setup({ identity: { uid: 'guest-1', signInProvider: 'anonymous' } });
  const response = await handler(event('POST', { name: 'Kelas Tamu' }));
  assert.equal(response.statusCode, 403);
  assert.equal(JSON.parse(response.body).error.code, 'FORBIDDEN');
  assert.equal(calls.length, 0);
});

test('POST /classes returns field validation errors', async () => {
  const { handler, calls } = setup();
  const response = await handler(event('POST', { name: 'A', description: 'Valid' }));
  assert.equal(response.statusCode, 400);
  const payload = JSON.parse(response.body);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
  assert.ok(payload.error.details.name);
  assert.equal(calls.length, 0);
});

test('GET /classes?scope=joined scopes memberships to the verified uid', async () => {
  const { handler, calls } = setup();
  const response = await handler(event('GET', undefined, '/classes', { query: { scope: 'joined' } }));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [['list-joined', 'user-1']]);
});

test('POST /classes/join normalizes code and uses verified member identity', async () => {
  const { handler, calls } = setup();
  const response = await handler(event('POST', { code: ' abc234 ', uid: 'attacker' }, '/classes/join', {
    headers: { 'X-Idempotency-Key': '12345678-abcd' },
  }));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls[0], ['join', {
    uid: 'user-1',
    name: 'Ibu Nisa',
    idempotencyKey: '12345678-abcd',
    code: 'ABC234',
  }]);
});

test('anonymous accounts cannot join a class', async () => {
  const { handler, calls } = setup({ identity: { uid: 'guest-1', signInProvider: 'anonymous' } });
  const response = await handler(event('POST', { code: 'ABC234' }, '/classes/join'));
  assert.equal(response.statusCode, 403);
  assert.equal(calls.length, 0);
});

test('class detail and members use the verified uid for access checks', async () => {
  const { handler, calls } = setup();
  const detail = await handler(event('GET', undefined, '/classes/class-123'));
  const members = await handler(event('GET', undefined, '/classes/class-123/members'));
  assert.equal(detail.statusCode, 200);
  assert.equal(members.statusCode, 200);
  assert.deepEqual(calls, [
    ['detail', 'class-123', 'user-1'],
    ['members', 'class-123', 'user-1'],
  ]);
});

test('invalid list scope and join idempotency key are rejected', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(event('GET', undefined, '/classes', { query: { scope: 'all' } }))).statusCode, 400);
  assert.equal((await handler(event('POST', { code: 'ABC234' }, '/classes/join', { headers: { 'x-idempotency-key': 'bad' } }))).statusCode, 400);
  assert.equal(calls.length, 0);
});

test('unknown paths and methods have explicit responses', async () => {
  const { handler } = setup();
  assert.equal((await handler(event('GET', undefined, '/missing'))).statusCode, 404);
  assert.equal((await handler(event('DELETE'))).statusCode, 405);
});
