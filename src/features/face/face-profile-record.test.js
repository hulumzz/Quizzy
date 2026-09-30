import assert from 'node:assert/strict';
import test from 'node:test';
import { FACE_PROFILE_MODEL_VERSION, normalizeFaceProfileInput, toFaceProfile } from './face-profile-record.js';

test('face profile record keeps a bounded numeric embedding and consent contract', () => {
  const profile = normalizeFaceProfileInput({ consent: true, modelVersion: FACE_PROFILE_MODEL_VERSION, embedding: Array.from({ length: 128 }, () => 0.125678912) });
  assert.equal(profile.schemaVersion, 1);
  assert.equal(profile.embedding.length, 128);
  assert.equal(profile.embedding[0], 0.12567891);
});

test('face profile reader accepts only the active compatible schema', () => {
  const profile = toFaceProfile({ schemaVersion: 1, modelVersion: FACE_PROFILE_MODEL_VERSION, status: 'active', embedding: Array(128).fill(0.1), consentVersion: '2026-09', enrolledAt: { toDate: () => new Date('2026-09-29T00:00:00.000Z') }, updatedAt: { toDate: () => new Date('2026-09-29T01:00:00.000Z') } });
  assert.equal(profile.enrolledAt, '2026-09-29T00:00:00.000Z');
  assert.equal(toFaceProfile({ schemaVersion: 2, modelVersion: FACE_PROFILE_MODEL_VERSION, status: 'active', embedding: [] }), null);
});
