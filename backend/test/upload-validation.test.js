import assert from 'node:assert/strict';
import test from 'node:test';
import { validateUploadIntent } from '../src/validation/upload.js';

test('upload intent maps safe images and documents to Cloudinary resource types', () => {
  assert.equal(validateUploadIntent({ fileName: 'diagram.webp', mimeType: 'image/webp', size: 1024 }).resourceType, 'image');
  assert.equal(validateUploadIntent({ fileName: 'modul.pdf', mimeType: 'application/pdf', size: 2048 }).resourceType, 'image');
});

test('upload intent rejects unsafe names, unsupported types, and oversized files', () => {
  assert.throws(() => validateUploadIntent({ fileName: '../file.pdf', mimeType: 'application/pdf', size: 100 }), (error) => error.code === 'VALIDATION_ERROR');
  assert.throws(() => validateUploadIntent({ fileName: 'script.svg', mimeType: 'image/svg+xml', size: 100 }), (error) => error.code === 'UNSUPPORTED_FILE_TYPE');
  assert.throws(() => validateUploadIntent({ fileName: 'large.png', mimeType: 'image/png', size: 9 * 1024 * 1024 }), (error) => error.code === 'FILE_TOO_LARGE');
});
