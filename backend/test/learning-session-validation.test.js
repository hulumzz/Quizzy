import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateLearningSessionInput,
  validateLearningSessionOrder,
  validateOptionalLearningSessionId,
} from '../src/validation/learning-session.js';

test('learning session input normalizes valid meeting data', () => {
  assert.deepEqual(validateLearningSessionInput({
    title: '  Pertemuan   1  ',
    description: 'Pengenalan materi',
    meetingDate: '2026-09-25',
    status: 'published',
  }), {
    title: 'Pertemuan 1',
    description: 'Pengenalan materi',
    meetingDate: '2026-09-25',
    status: 'published',
  });
});

test('learning session rejects impossible dates and duplicate reorder ids', () => {
  assert.throws(() => validateLearningSessionInput({
    title: 'Pertemuan 1',
    meetingDate: '2026-02-30',
    status: 'draft',
  }), (error) => error?.code === 'VALIDATION_ERROR');

  assert.throws(() => validateLearningSessionOrder({
    sessionIds: ['session-1', 'session-1'],
  }), (error) => error?.code === 'VALIDATION_ERROR');
});

test('optional learning session id keeps legacy unassigned content valid', () => {
  assert.equal(validateOptionalLearningSessionId(undefined), null);
  assert.equal(validateOptionalLearningSessionId(''), null);
  assert.equal(validateOptionalLearningSessionId('session-123'), 'session-123');
});
