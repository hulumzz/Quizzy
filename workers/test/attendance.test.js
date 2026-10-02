import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDistanceMeters } from '../src/repositories/attendance.repository.js';
import { validateAttendanceInput, validateAttendanceStatus, validateCheckIn } from '../src/validation/attendance.js';

test('on-site attendance normalizes the venue and radius', () => {
  assert.deepEqual(validateAttendanceInput({ title: '  Pertemuan  1 ', locationMode: 'on_site', latitude: '-6.98', longitude: '109.64', radiusMeters: '120' }), { title: 'Pertemuan 1', locationMode: 'on_site', latitude: -6.98, longitude: 109.64, radiusMeters: 120, sessionId: null, verificationMode: 'standard' });
  assert.deepEqual(validateAttendanceInput({ title: 'Pertemuan daring' }), { title: 'Pertemuan daring', locationMode: 'online', latitude: null, longitude: null, radiusMeters: null, sessionId: null, verificationMode: 'standard' });
});

test('attendance validation protects the server-calculated venue rules', () => {
  assert.throws(() => validateAttendanceInput({ title: 'Pertemuan 1', locationMode: 'on_site', latitude: 99, longitude: 200, radiusMeters: 5001 }), (error) => error.code === 'VALIDATION_ERROR');
  assert.deepEqual(validateAttendanceStatus({ status: 'active' }), { status: 'active' });
  assert.throws(() => validateAttendanceStatus({ status: 'draft' }), (error) => error.code === 'VALIDATION_ERROR');
  assert.throws(() => validateCheckIn({ latitude: -6.98, longitude: '' }), (error) => error.code === 'VALIDATION_ERROR');
  assert.ok(calculateDistanceMeters(-6.98, 109.64, -6.98, 109.64) < 0.01);
});

test('verificationMode validation accepts valid values and defaults to standard', () => {
  assert.equal(validateAttendanceInput({ title: 'Sesi A', verificationMode: 'face_optional' }).verificationMode, 'face_optional');
  assert.equal(validateAttendanceInput({ title: 'Sesi B', verificationMode: 'face_required' }).verificationMode, 'face_required');
  assert.equal(validateAttendanceInput({ title: 'Sesi C' }).verificationMode, 'standard');
  assert.throws(() => validateAttendanceInput({ title: 'Sesi D', verificationMode: 'biometric' }), (error) => error.code === 'VALIDATION_ERROR');
});

test('verificationMethod validation accepts valid values and defaults to standard', () => {
  assert.equal(validateCheckIn({}).verificationMethod, 'standard');
  assert.equal(validateCheckIn({ verificationMethod: 'face' }).verificationMethod, 'face');
  assert.throws(() => validateCheckIn({ verificationMethod: 'retina' }), (error) => error.code === 'VALIDATION_ERROR');
});
