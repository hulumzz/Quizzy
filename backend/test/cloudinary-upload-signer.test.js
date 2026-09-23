import assert from 'node:assert/strict';
import test from 'node:test';
import { CloudinaryUploadSigner } from '../src/services/cloudinary-upload-signer.js';

test('upload signer authorizes the class owner and returns no API secret', async () => {
  const signer = new CloudinaryUploadSigner({
    classRepository: { async getForUser() { return { accessRole: 'owner' }; } },
    cloudName: 'quizzy-cloud', apiKey: 'public-key', apiSecret: 'private-test-secret', now: () => 1700000000000,
  });
  const result = await signer.createSignature({ classId: 'class-1', uid: 'teacher-1', resourceType: 'image' });
  assert.equal(result.parameters.timestamp, 1700000000);
  assert.equal(result.parameters.folder, 'quizzy/classes/class-1');
  assert.equal(result.signature.length, 64);
  assert.equal(JSON.stringify(result).includes('private-test-secret'), false);
});

test('upload signer rejects class members and missing configuration', async () => {
  const member = new CloudinaryUploadSigner({ classRepository: { async getForUser() { return { accessRole: 'member' }; } }, cloudName: 'cloud', apiKey: 'key', apiSecret: 'secret' });
  await assert.rejects(member.createSignature({ classId: 'class-1', uid: 'student-1', resourceType: 'image' }), (error) => error.statusCode === 403);
  const unconfigured = new CloudinaryUploadSigner({ classRepository: { async getForUser() { return { accessRole: 'owner' }; } }, cloudName: '', apiKey: '', apiSecret: '' });
  await assert.rejects(unconfigured.createSignature({ classId: 'class-1', uid: 'teacher-1', resourceType: 'image' }), (error) => error.code === 'UPLOAD_NOT_CONFIGURED');
});

test('upload signer reads the deployed secret from its single SSM parameter once per Lambda container', async () => {
  const calls = [];
  const signer = new CloudinaryUploadSigner({
    classRepository: { async getForUser() { return { accessRole: 'owner' }; } },
    cloudName: 'quizzy-cloud', apiKey: 'public-key', apiSecret: '', apiSecretParameter: '/quizzy/dev/cloudinary-api-secret',
    ssmClient: { async send(command) { calls.push(command.input); return { Parameter: { Value: 'runtime-secret' } }; } }, now: () => 1700000000000,
  });
  await signer.createSignature({ classId: 'class-1', uid: 'teacher-1', resourceType: 'image' });
  await signer.createSignature({ classId: 'class-1', uid: 'teacher-1', resourceType: 'image' });
  assert.deepEqual(calls, [{ Name: '/quizzy/dev/cloudinary-api-secret', WithDecryption: true }]);
});
