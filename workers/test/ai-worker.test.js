import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
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


test('AI endpoint accepts a correctly signed Firebase token using Google JWKS format', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const encodedHeader = encode({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  const encodedPayload = encode({
    aud: 'quizzy-test',
    iss: 'https://securetoken.google.com/quizzy-test',
    sub: 'teacher-1',
    exp: now + 3600,
    iat: now - 30,
    auth_time: now - 60,
    firebase: { sign_in_provider: 'google.com' },
  });
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url');
  const token = `${unsigned}.${signature}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/service_accounts/v1/jwk/')) {
      return new Response(JSON.stringify({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
      });
    }
    if (target === 'https://api.groq.com/openai/v1/chat/completions') {
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"questions":[]}' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };
  try {
    const response = await app.fetch(request('/api/ai/assist', {
      method: 'POST',
      headers: { origin: 'https://app.quizzy.test', authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'quiz_draft', context: 'Materi IPA' }),
    }), {
      ...environment,
      GROQ_API_KEY: 'test-key',
      AI_RATE_LIMITER: { async limit() { return { success: true }; } },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.task, 'quiz_draft');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
