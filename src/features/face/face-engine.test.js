import assert from 'node:assert/strict';
import test from 'node:test';
import { createFaceChallenge, isChallengeComplete } from './face-challenge.js';
import { averageEmbeddings, cosineSimilarity, enrollmentGuidance } from './face-engine.js';

test('face embeddings average consistently and compare with cosine similarity', () => {
  assert.deepEqual(averageEmbeddings([[1, 3], [3, 5]]), [2, 4]);
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1], [1, 2]), 0);
});

test('the active challenge is randomised and needs the requested head turn', () => {
  const left = createFaceChallenge(() => 0);
  const right = createFaceChallenge(() => 0.99);
  assert.equal(left.id, 'look_left');
  assert.equal(right.id, 'look_right');
  assert.equal(isChallengeComplete(left, -13), true);
  assert.equal(isChallengeComplete(left, 13), false);
  assert.equal(isChallengeComplete(right, 13), true);
});

test('enrollment guidance only enables capture for a centred, clear face', () => {
  const ready = enrollmentGuidance({ confidence: 0.9, box: [0.35, 0.25, 0.3, 0.42], yaw: 0, pitch: 0 }, 130);
  assert.equal(ready.ready, true);
  assert.match(ready.instruction, /Posisi sudah baik/);
  assert.match(enrollmentGuidance({ confidence: 0.9, box: [0.35, 0.25, 0.12, 0.18], yaw: 0, pitch: 0 }, 130).instruction, /Dekatkan/);
  assert.match(enrollmentGuidance({ confidence: 0.9, box: [0.35, 0.25, 0.3, 0.42], yaw: 0, pitch: 0 }, 25).instruction, /pencahayaan/i);
  assert.match(enrollmentGuidance({ confidence: 0.9, box: [0.35, 0.25, 0.3, 0.42], yaw: 21, pitch: 0 }, 130).instruction, /lurus/i);
});
