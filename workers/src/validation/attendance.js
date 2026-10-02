import { badRequest } from '../http/errors.js';

const clean = (value) => typeof value === 'string' ? value.trim() : '';
const id = (value, code, message) => { if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z0-9-]+$/.test(value)) throw badRequest(code, message); return value; };
function coordinate(value, field, min, max, errors) { const number = Number(value); if (value === '' || value === null || value === undefined || !Number.isFinite(number) || number < min || number > max) errors[field] = `${field === 'latitude' ? 'Latitude' : 'Longitude'} tidak valid.`; return number; }

const VERIFICATION_MODES = ['standard', 'face_optional', 'face_required'];
const VERIFICATION_METHODS = ['standard', 'face'];

export const validateAttendanceId = (value) => id(value, 'INVALID_ATTENDANCE_ID', 'Identitas sesi presensi tidak valid.');
export function validateAttendanceInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Data sesi presensi tidak valid.');
  const title = clean(input.title).replace(/\s+/g, ' '); const locationMode = clean(input.locationMode || 'online'); const errors = {};
  if (title.length < 3 || title.length > 100) errors.title = 'Nama sesi harus terdiri dari 3-100 karakter.';
  if (!['online', 'on_site'].includes(locationMode)) errors.locationMode = 'Mode presensi tidak valid.';
  const verificationMode = clean(input.verificationMode || 'standard');
  if (!VERIFICATION_MODES.includes(verificationMode)) errors.verificationMode = 'Metode verifikasi tidak valid. Gunakan standard, face_optional, atau face_required.';
  let latitude = null; let longitude = null; let radiusMeters = null;
  if (locationMode === 'on_site') { latitude = coordinate(input.latitude, 'latitude', -90, 90, errors); longitude = coordinate(input.longitude, 'longitude', -180, 180, errors); radiusMeters = Number(input.radiusMeters); if (!Number.isInteger(radiusMeters) || radiusMeters < 10 || radiusMeters > 1000) errors.radiusMeters = 'Radius harus berupa angka bulat 10-1.000 meter.'; }
  const sessionId = input.sessionId === null || input.sessionId === undefined || input.sessionId === '' ? null : id(input.sessionId, 'INVALID_LEARNING_SESSION_ID', 'Identitas sesi belajar tidak valid.');
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa kembali sesi presensi.', errors);
  return { title, locationMode, latitude, longitude, radiusMeters, sessionId, verificationMode };
}
export function validateAttendanceStatus(input) { const status = clean(input?.status); if (!['active', 'ended'].includes(status)) throw badRequest('VALIDATION_ERROR', 'Periksa kembali status presensi.', { status: 'Status harus active atau ended.' }); return { status }; }
export function validateCheckIn(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Data lokasi presensi tidak valid.');
  const errors = {}; const hasLatitude = input.latitude !== undefined && input.latitude !== null && input.latitude !== ''; const hasLongitude = input.longitude !== undefined && input.longitude !== null && input.longitude !== ''; let latitude = null; let longitude = null;
  if (hasLatitude || hasLongitude) { latitude = coordinate(input.latitude, 'latitude', -90, 90, errors); longitude = coordinate(input.longitude, 'longitude', -180, 180, errors); }
  const accuracyMeters = input.accuracyMeters === undefined || input.accuracyMeters === null ? null : Number(input.accuracyMeters);
  if (accuracyMeters !== null && (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 5000)) errors.accuracyMeters = 'Akurasi lokasi tidak valid.';
  const verificationMethod = clean(input.verificationMethod || 'standard');
  if (!VERIFICATION_METHODS.includes(verificationMethod)) errors.verificationMethod = 'Metode presensi tidak valid. Gunakan standard atau face.';
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa kembali lokasi presensi.', errors);
  return { latitude, longitude, accuracyMeters, verificationMethod };
}
