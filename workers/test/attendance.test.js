import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDistanceMeters } from '../src/repositories/attendance.repository.js';
import { validateAttendanceInput, validateAttendanceStatus, validateCheckIn } from '../src/validation/attendance.js';

test('on-site attendance normalizes the venue and radius', () => {
  assert.deepEqual(validateAttendanceInput({ title: '  Pertemuan  1 ', locationMode: 'on_site', latitude: '-6.98', longitude: '109.64', radiusMeters: '120' }), { title: 'Pertemuan 1', locationMode: 'on_site', latitude: -6.98, longitude: 109.64, radiusMeters: 120, sessionId: null });
  assert.deepEqual(validateAttendanceInput({ title: 'Pertemuan daring' }), { title: 'Pertemuan daring', locationMode: 'online', latitude: null, longitude: null, radiusMeters: null, sessionId: null });
});

test('attendance validation protects the server-calculated venue rules', () => {
  assert.throws(() => validateAttendanceInput({ title: 'Pertemuan 1', locationMode: 'on_site', latitude: 99, longitude: 200, radiusMeters: 5001 }), (error) => error.code === 'VALIDATION_ERROR');
  assert.deepEqual(validateAttendanceStatus({ status: 'active' }), { status: 'active' });
  assert.throws(() => validateAttendanceStatus({ status: 'draft' }), (error) => error.code === 'VALIDATION_ERROR');
  assert.throws(() => validateCheckIn({ latitude: -6.98, longitude: '' }), (error) => error.code === 'VALIDATION_ERROR');
  assert.ok(calculateDistanceMeters(-6.98, 109.64, -6.98, 109.64) < 0.01);
});
