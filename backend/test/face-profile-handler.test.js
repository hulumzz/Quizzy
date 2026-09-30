import assert from 'node:assert/strict';
import test from 'node:test';
import { createFaceProfilesHandler } from '../src/functions/face-profiles/handler.js';

function event(method, body) {
  return { rawPath: '/me/face-profile', body: body === undefined ? undefined : JSON.stringify(body), requestContext: { http: { method }, requestId: 'face-request' } };
}

function setup(identity = { uid: 'student-1', signInProvider: 'google.com' }) {
  const calls = [];
  const repository = {
    async get(uid) { calls.push(['get', uid]); return null; },
    async save(input) { calls.push(['save', input]); return { ...input, status: 'active', enrolledAt: '2026-09-29T00:00:00.000Z', updatedAt: '2026-09-29T00:00:00.000Z' }; },
    async remove(uid) { calls.push(['remove', uid]); },
  };
  return { calls, handler: createFaceProfilesHandler({ authenticate: async () => identity, repository, logger: { error() {} } }) };
}

const validProfile = { consent: true, modelVersion: 'human-v1', embedding: Array.from({ length: 128 }, (_, index) => index / 100) };

test('face profile is always scoped to the Firebase identity, never a request uid', async () => {
  const { calls, handler } = setup();
  const response = await handler(event('PUT', { ...validProfile, uid: 'attacker' }));
  assert.equal(response.statusCode, 200);
  assert.equal(calls[0][1].uid, 'student-1');
  assert.equal(calls[0][1].embedding.length, 128);
  assert.equal(calls[0][1].rawImage, undefined);
  assert.equal((await handler(event('DELETE'))).statusCode, 204);
  assert.deepEqual(calls[1], ['remove', 'student-1']);
});

test('face profile requires explicit consent, a known model, and bounded numeric embeddings', async () => {
  const { handler } = setup();
  const missingConsent = await handler(event('PUT', { ...validProfile, consent: false }));
  const invalidEmbedding = await handler(event('PUT', { ...validProfile, embedding: ['not-a-number'] }));
  assert.equal(missingConsent.statusCode, 400);
  assert.equal(invalidEmbedding.statusCode, 400);
});

test('anonymous accounts cannot read a face profile', async () => {
  const { handler } = setup({ uid: 'guest-1', signInProvider: 'anonymous' });
  assert.equal((await handler(event('GET'))).statusCode, 403);
});
