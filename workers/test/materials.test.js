import assert from 'node:assert/strict';
import test from 'node:test';
import { CloudinaryUploadSigner } from '../src/services/cloudinary.js';
import { validateMaterialInput, validateUploadIntent } from '../src/validation/materials.js';

test('material input keeps supported content blocks and rejects unsafe URLs', () => {
  const material = validateMaterialInput({ title: 'Energi', status: 'published', blocks: [{ id: 'heading-1', type: 'heading', level: 2, content: 'Energi' }, { id: 'file-1', type: 'file', url: 'https://res.cloudinary.com/demo/raw/upload/modul.pdf', label: 'Modul' }] });
  assert.equal(material.blocks.length, 2);
  assert.throws(() => validateMaterialInput({ title: 'Energi', blocks: [{ id: 'bad-1', type: 'link', url: 'http://unsafe.test', label: '' }] }), (error) => error.code === 'VALIDATION_ERROR');
});

test('upload validation preserves existing image and document limits', () => {
  assert.equal(validateUploadIntent({ fileName: 'foto.png', mimeType: 'image/png', size: 8 * 1024 * 1024 }).resourceType, 'image');
  assert.equal(validateUploadIntent({ fileName: 'modul.pdf', mimeType: 'application/pdf', size: 15 * 1024 * 1024 }).resourceType, 'image');
  assert.equal(validateUploadIntent({ fileName: 'materi.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 100 }).resourceType, 'raw');
  assert.throws(() => validateUploadIntent({ fileName: '../secret.png', mimeType: 'image/png', size: 100 }), (error) => error.code === 'VALIDATION_ERROR');
});

test('Cloudinary signature is server-side and class-owner scoped', async () => {
  const signer = new CloudinaryUploadSigner({ classRepository: { async getForUser() { return { accessRole: 'owner' }; } }, cloudName: 'cloud', apiKey: 'key', apiSecret: 'secret', now: () => 1_700_000_000_000 });
  const upload = await signer.createSignature({ classId: 'class-1', uid: 'teacher-1', resourceType: 'image' });
  assert.equal(upload.folder, undefined);
  assert.equal(upload.parameters.folder, 'quizzy/classes/class-1');
  assert.match(upload.signature, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(upload).includes('secret'), false);
});
