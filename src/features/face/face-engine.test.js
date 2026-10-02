import assert from 'node:assert/strict';
import test from 'node:test';
import { createFaceChallenge, isChallengeComplete } from './face-challenge.js';
import { averageEmbeddings, cosineSimilarity, enrollmentGuidance, radiansToDegrees, readFace } from './face-engine.js';

test('radiansToDegrees converts Human.js rotation to degrees correctly', () => {
  assert.ok(Math.abs(radiansToDegrees(Math.PI / 6) - 30) < 0.001, 'π/6 radian harus 30°');
  assert.ok(Math.abs(radiansToDegrees(-Math.PI / 12) + 15) < 0.001, '-π/12 radian harus -15°');
  assert.equal(radiansToDegrees(null), 0, 'null harus menghasilkan 0');
  assert.equal(radiansToDegrees(undefined), 0, 'undefined harus menghasilkan 0');
  assert.equal(radiansToDegrees('invalid'), 0, 'string non-numerik harus menghasilkan 0');
});

test('face embeddings average consistently and compare with cosine similarity', () => {
  assert.deepEqual(averageEmbeddings([[1, 3], [3, 5]]), [2, 4]);
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1], [1, 2]), 0);
});

test('Human result boundary converts both axes before challenges and enrollment guidance', () => {
  const sample = (yaw, pitch) => readFace({ face: [{
    embedding: Array(64).fill(0.1), score: 0.9, boxRaw: [0.35, 0.25, 0.3, 0.42],
    rotation: { angle: { yaw, pitch } },
  }] });
  const left = sample(-Math.PI / 12, 0);
  const right = sample(Math.PI / 12, 0);
  assert.ok(Math.abs(left.yaw + 15) < 0.001);
  assert.ok(Math.abs(right.yaw - 15) < 0.001);
  assert.equal(isChallengeComplete(createFaceChallenge(() => 0), left.yaw), true);
  assert.equal(isChallengeComplete(createFaceChallenge(() => 0.99), right.yaw), true);
  assert.equal(isChallengeComplete(createFaceChallenge(() => 0), sample(-8 * Math.PI / 180, 0).yaw), false);
  assert.equal(isChallengeComplete(createFaceChallenge(() => 0.99), sample(8 * Math.PI / 180, 0).yaw), false);
  const tilted = sample(0, Math.PI / 9);
  assert.ok(Math.abs(tilted.pitch - 20) < 0.001);
  assert.equal(enrollmentGuidance(tilted, 130).ready, false);
  assert.equal(enrollmentGuidance(sample(Math.PI / 6, 0), 130).ready, false);
  assert.equal(enrollmentGuidance(sample(0, 0), 130).ready, true);
});

// Nilai -13 dan 13 berikut adalah degree (setelah normalisasi dari radian oleh readFace).
// Contoh: yaw ≈ -0.227 radian → radiansToDegrees → -13°
test('the active challenge is randomised and needs the requested head turn (degree domain)', () => {
  const left = createFaceChallenge(() => 0);
  const right = createFaceChallenge(() => 0.99);
  assert.equal(left.id, 'look_left');
  assert.equal(right.id, 'look_right');
  // -13° memenuhi threshold look_left (<= -12°) — nilai dalam degree setelah normalisasi
  assert.equal(isChallengeComplete(left, -13), true);
  assert.equal(isChallengeComplete(left, -8), false, '-8° tidak memenuhi look_left');
  assert.equal(isChallengeComplete(left, 13), false);
  // 13° memenuhi threshold look_right (>= 12°) — nilai dalam degree setelah normalisasi
  assert.equal(isChallengeComplete(right, 13), true);
  assert.equal(isChallengeComplete(right, 8), false, '8° tidak memenuhi look_right');
});

test('enrollment guidance only enables capture for a centred, clear face', () => {
  const ready = enrollmentGuidance({ confidence: 0.9, box: [0.35, 0.25, 0.3, 0.42], yaw: 0, pitch: 0 }, 130);
  assert.equal(ready.ready, true);
  assert.match(ready.instruction, /Posisi sudah baik/);
  assert.match(enrollmentGuidance({ confidence: 0.9, box: [0.35, 0.25, 0.12, 0.18], yaw: 0, pitch: 0 }, 130).instruction, /Dekatkan/);
  assert.match(enrollmentGuidance({ confidence: 0.9, box: [0.35, 0.25, 0.3, 0.42], yaw: 0, pitch: 0 }, 25).instruction, /pencahayaan/i);
  // 21° melewati threshold 16° — nilai dalam degree
  assert.match(enrollmentGuidance({ confidence: 0.9, box: [0.35, 0.25, 0.3, 0.42], yaw: 21, pitch: 0 }, 130).instruction, /lurus/i);
});
