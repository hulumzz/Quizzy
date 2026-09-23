import assert from 'node:assert/strict';
import test from 'node:test';
import { createUploadsHandler } from '../src/functions/uploads/handler.js';

const request = (identity, body) => ({ rawPath: '/classes/class-1/uploads/signature', body: JSON.stringify(body), requestContext: { http: { method: 'POST' }, requestId: 'upload-request' }, identity });

test('upload signature handler derives identity from authentication', async () => {
  const calls = [];
  const handler = createUploadsHandler({ authenticate: async (event) => event.identity, signer: { async createSignature(input) { calls.push(input); return { provider: 'cloudinary' }; } }, logger: { error() {} } });
  const response = await handler(request({ uid: 'teacher-1', signInProvider: 'google.com' }, { fileName: 'image.png', mimeType: 'image/png', size: 1024, uid: 'attacker' }));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls[0], { classId: 'class-1', uid: 'teacher-1', resourceType: 'image' });
});

test('upload signature handler rejects anonymous and invalid files', async () => {
  const signer = { async createSignature() { throw new Error('should not run'); } };
  const handler = createUploadsHandler({ authenticate: async (event) => event.identity, signer, logger: { error() {} } });
  assert.equal((await handler(request({ uid: 'guest', signInProvider: 'anonymous' }, { fileName: 'image.png', mimeType: 'image/png', size: 10 }))).statusCode, 403);
  assert.equal((await handler(request({ uid: 'teacher', signInProvider: 'password' }, { fileName: 'code.html', mimeType: 'text/html', size: 10 }))).statusCode, 400);
});
