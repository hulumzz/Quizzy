import { badRequest } from '../http/errors.js';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function coordinate(value, field, min, max, errors) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    errors[field] = `${field === 'latitude' ? 'Latitude' : 'Longitude'} tidak valid.`;
  }
  return number;
}

export function validateAttendanceId(value) {
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z0-9-]+$/.test(value)) {
    throw badRequest('INVALID_ATTENDANCE_ID', 'Identitas sesi presensi tidak valid.');
  }
  return value;
}

export function validateAttendanceInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('INVALID_BODY', 'Data sesi presensi tidak valid.');
  }
  const title = cleanText(input.title).replace(/\s+/g, ' ');
  const errors = {};
  if (title.length < 3 || title.length > 100) errors.title = 'Nama sesi harus terdiri dari 3–100 karakter.';
  const latitude = coordinate(input.latitude, 'latitude', -90, 90, errors);
  const longitude = coordinate(input.longitude, 'longitude', -180, 180, errors);
  const radiusMeters = Number(input.radiusMeters);
  if (!Number.isInteger(radiusMeters) || radiusMeters < 10 || radiusMeters > 1000) {
    errors.radiusMeters = 'Radius harus berupa angka bulat 10–1.000 meter.';
  }
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa kembali sesi presensi.', errors);
  return { title, latitude, longitude, radiusMeters };
}

export function validateAttendanceStatus(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('INVALID_BODY', 'Data status presensi tidak valid.');
  }
  const status = cleanText(input.status);
  if (!['active', 'ended'].includes(status)) {
    throw badRequest('VALIDATION_ERROR', 'Periksa kembali status presensi.', { status: 'Status harus active atau ended.' });
  }
  return { status };
}

export function validateCheckIn(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('INVALID_BODY', 'Data lokasi presensi tidak valid.');
  }
  const errors = {};
  const latitude = coordinate(input.latitude, 'latitude', -90, 90, errors);
  const longitude = coordinate(input.longitude, 'longitude', -180, 180, errors);
  const accuracyMeters = input.accuracyMeters === undefined || input.accuracyMeters === null
    ? null
    : Number(input.accuracyMeters);
  if (accuracyMeters !== null && (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > 5000)) {
    errors.accuracyMeters = 'Akurasi lokasi tidak valid.';
  }
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa kembali lokasi presensi.', errors);
  return { latitude, longitude, accuracyMeters };
}
