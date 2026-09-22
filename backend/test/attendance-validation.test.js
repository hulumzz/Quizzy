import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAttendanceInput, validateAttendanceStatus, validateCheckIn } from '../src/validation/attendance.js';

test('attendance input normalizes title, coordinates, and radius', () => {
  assert.deepEqual(validateAttendanceInput({ title: '  Pertemuan  1 ', latitude: '-6.98', longitude: '109.64', radiusMeters: '120' }), {
    title: 'Pertemuan 1',
    latitude: -6.98,
    longitude: 109.64,
    radiusMeters: 120,
  });
});

test('attendance input rejects invalid coordinates and unsafe radius', () => {
  assert.throws(
    () => validateAttendanceInput({ title: 'Pertemuan 1', latitude: 99, longitude: 200, radiusMeters: 5001 }),
    (error) => error.code === 'VALIDATION_ERROR' && Boolean(error.details.latitude) && Boolean(error.details.radiusMeters),
  );
});

test('attendance status only accepts active and ended', () => {
  assert.deepEqual(validateAttendanceStatus({ status: 'active' }), { status: 'active' });
  assert.deepEqual(validateAttendanceStatus({ status: 'ended' }), { status: 'ended' });
  assert.throws(() => validateAttendanceStatus({ status: 'draft' }), (error) => error.code === 'VALIDATION_ERROR');
});

test('check-in accepts zero coordinates and validates accuracy', () => {
  assert.deepEqual(validateCheckIn({ latitude: 0, longitude: 0, accuracyMeters: 25 }), { latitude: 0, longitude: 0, accuracyMeters: 25 });
  assert.throws(() => validateCheckIn({ latitude: 0, longitude: 0, accuracyMeters: -1 }), (error) => error.code === 'VALIDATION_ERROR');
});
