import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLiveAnswer, validateLiveCode, validateLiveJoin, validateLiveSessionInput } from '../src/validation/live-quiz.js';

test('live quiz validators normalize a code, a participant, and bounded duration', () => {
  assert.equal(validateLiveCode(' ab2cde '), 'AB2CDE');
  assert.deepEqual(validateLiveJoin({ name: '  Siti   Nurhaliza ' }), { name: 'Siti Nurhaliza' });
  assert.deepEqual(validateLiveSessionInput({ questionDurationSeconds: 45 }), { questionDurationSeconds: 45 });
});

test('live answer validator retains only the signed participant receipt fields', () => {
  const token = 'a'.repeat(64);
  assert.deepEqual(validateLiveAnswer({ participantId: 'p-1', participantToken: token, questionId: 'q_1', answer: true, score: 999 }), { participantId: 'p-1', participantToken: token, questionId: 'q_1', answer: true });
  assert.throws(() => validateLiveCode('O0I1LL'), (error) => error.code === 'INVALID_LIVE_CODE');
  assert.throws(() => validateLiveSessionInput({ questionDurationSeconds: 2 }), (error) => error.code === 'VALIDATION_ERROR');
});
