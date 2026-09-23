import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../src/index.js';

const environment = { ALLOWED_ORIGINS: 'https://app.quizzy.test', FIREBASE_PROJECT_ID: 'quizzy-test' };
const request = (path, options = {}) => new Request(`https://quizzy.skripzy-app.workers.dev${path}`, options);

test('healthcheck is public and does not expose configuration', async () => {
  const response = await app.fetch(request('/', { headers: { origin: 'https://app.quizzy.test' } }), environment);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.quizzy.test');
  assert.deepEqual(await response.json(), { name: 'Quizzy AI Gateway', status: 'online' });
});

test('AI endpoint requires a Firebase bearer token before using the provider', async () => {
  const response = await app.fetch(request('/api/ai/assist', { method: 'POST', headers: { origin: 'https://app.quizzy.test', 'content-type': 'application/json' }, body: JSON.stringify({ task: 'quiz_draft', context: 'Materi IPA' }) }), environment);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
});

test('AI endpoint reports missing Firebase configuration without a generic server error', async () => {
  const response = await app.fetch(request('/api/ai/assist', { method: 'POST' }), { ALLOWED_ORIGINS: 'https://app.quizzy.test' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AI_NOT_CONFIGURED');
});

test('CORS preflight only accepts explicit origins', async () => {
  const allowed = await app.fetch(request('/api/ai/assist', { method: 'OPTIONS', headers: { origin: 'https://app.quizzy.test' } }), environment);
  const rejected = await app.fetch(request('/api/ai/assist', { method: 'OPTIONS', headers: { origin: 'https://attacker.test' } }), environment);
  assert.equal(allowed.status, 204);
  assert.equal(rejected.status, 403);
});
