import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAttendanceInput, validateAttendanceStatus, validateCheckIn } from '../src/validation/attendance.js';

test('on-site attendance normalizes title, coordinates, and radius', () => {
  assert.deepEqual(validateAttendanceInput({ title: '  Pertemuan  1 ', locationMode: 'on_site', latitude: '-6.98', longitude: '109.64', radiusMeters: '120' }), {
    title: 'Pertemuan 1', locationMode: 'on_site', latitude: -6.98, longitude: 109.64, radiusMeters: 120, sessionId: null,
  });
});

test('online attendance does not request or retain a location', () => {
  assert.deepEqual(validateAttendanceInput({ title: 'Pertemuan daring' }), {
    title: 'Pertemuan daring', locationMode: 'online', latitude: null, longitude: null, radiusMeters: null, sessionId: null,
  });
});

test('on-site attendance rejects invalid coordinates and unsafe radius', () => {
  assert.throws(
    () => validateAttendanceInput({ title: 'Pertemuan 1', locationMode: 'on_site', latitude: 99, longitude: 200, radiusMeters: 5001 }),
    (error) => error.code === 'VALIDATION_ERROR' && Boolean(error.details.latitude) && Boolean(error.details.radiusMeters),
  );
});

test('attendance status only accepts active and ended', () => {
  assert.deepEqual(validateAttendanceStatus({ status: 'active' }), { status: 'active' });
  assert.deepEqual(validateAttendanceStatus({ status: 'ended' }), { status: 'ended' });
  assert.throws(() => validateAttendanceStatus({ status: 'draft' }), (error) => error.code === 'VALIDATION_ERROR');
});

test('check-in accepts an online empty payload and validates supplied coordinates', () => {
  assert.deepEqual(validateCheckIn({}), { latitude: null, longitude: null, accuracyMeters: null });
  assert.deepEqual(validateCheckIn({ latitude: 0, longitude: 0, accuracyMeters: 25 }), { latitude: 0, longitude: 0, accuracyMeters: 25 });
  assert.throws(() => validateCheckIn({ latitude: 0, longitude: 0, accuracyMeters: -1 }), (error) => error.code === 'VALIDATION_ERROR');
});
