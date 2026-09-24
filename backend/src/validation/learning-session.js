import { badRequest } from '../http/errors.js';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validMeetingDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateLearningSessionId(value) {
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z0-9-]+$/.test(value)) {
    throw badRequest('INVALID_SESSION_ID', 'Identitas pertemuan tidak valid.');
  }
  return value;
}

export function validateOptionalLearningSessionId(value) {
  if (value === undefined || value === null || value === '') return null;
  return validateLearningSessionId(value);
}

export function validateLearningSessionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('INVALID_BODY', 'Data pertemuan tidak valid.');
  }
  const title = cleanText(input.title).replace(/\s+/g, ' ');
  const description = cleanText(input.description);
  const meetingDate = cleanText(input.meetingDate);
  const status = cleanText(input.status) || 'draft';
  const errors = {};

  if (title.length < 3 || title.length > 120) errors.title = 'Judul pertemuan harus terdiri dari 3–120 karakter.';
  if (description.length > 600) errors.description = 'Deskripsi pertemuan maksimal 600 karakter.';
  if (!validMeetingDate(meetingDate)) errors.meetingDate = 'Tanggal pertemuan tidak valid.';
  if (!['draft', 'published', 'archived'].includes(status)) errors.status = 'Status pertemuan tidak valid.';

  if (Object.keys(errors).length) {
    throw badRequest('VALIDATION_ERROR', 'Periksa kembali data pertemuan.', errors);
  }
  return { title, description, meetingDate, status };
}

export function validateLearningSessionOrder(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.sessionIds)) {
    throw badRequest('INVALID_BODY', 'Urutan pertemuan tidak valid.');
  }
  if (!input.sessionIds.length || input.sessionIds.length > 100) {
    throw badRequest('VALIDATION_ERROR', 'Urutan pertemuan harus berisi 1–100 item.');
  }
  const sessionIds = input.sessionIds.map(validateLearningSessionId);
  if (new Set(sessionIds).size !== sessionIds.length) {
    throw badRequest('VALIDATION_ERROR', 'Urutan pertemuan tidak boleh berisi ID yang sama.');
  }
  return { sessionIds };
}
