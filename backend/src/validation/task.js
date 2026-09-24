import { badRequest, HttpError } from '../http/errors.js';
import { validateOptionalLearningSessionId } from './learning-session.js';

export const TASK_ATTACHMENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain',
]);

function text(value) { return typeof value === 'string' ? value.trim() : ''; }

function validDate(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

export function validateTaskId(value) {
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z0-9-]+$/.test(value)) throw badRequest('INVALID_TASK_ID', 'Identitas tugas tidak valid.');
  return value;
}

export function validateTaskInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Data tugas tidak valid.');
  const title = text(input.title).replace(/\s+/g, ' ');
  const instructions = text(input.instructions);
  const dueAt = text(input.dueAt);
  const responseMode = text(input.responseMode) || 'both';
  const status = text(input.status) || 'published';
  const errors = {};
  if (title.length < 3 || title.length > 160) errors.title = 'Judul tugas harus terdiri dari 3–160 karakter.';
  if (instructions.length > 5000) errors.instructions = 'Petunjuk tugas maksimal 5.000 karakter.';
  if (!validDate(dueAt)) errors.dueAt = 'Tenggat tugas harus berupa tanggal dan waktu ISO yang valid.';
  if (!['text', 'attachment', 'both'].includes(responseMode)) errors.responseMode = 'Bentuk jawaban tidak valid.';
  if (!['draft', 'published', 'archived'].includes(status)) errors.status = 'Status tugas tidak valid.';
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa kembali data tugas.', errors);
  return { title, instructions, dueAt, responseMode, status, sessionId: validateOptionalLearningSessionId(input.sessionId) };
}

export function validateSubmissionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Jawaban tugas tidak valid.');
  const textAnswer = text(input.textAnswer);
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  if (textAnswer.length > 10000) throw badRequest('VALIDATION_ERROR', 'Jawaban teks maksimal 10.000 karakter.', { textAnswer: 'Terlalu panjang.' });
  if (attachments.length > 5) throw badRequest('VALIDATION_ERROR', 'Lampiran maksimal 5 file.', { attachments: 'Terlalu banyak file.' });
  const cleaned = attachments.map((attachment) => {
    const name = text(attachment?.name);
    const url = text(attachment?.url);
    const publicId = text(attachment?.publicId);
    const mimeType = text(attachment?.mimeType).toLowerCase();
    const bytes = Number(attachment?.bytes);
    const image = mimeType.startsWith('image/');
    const maxBytes = image ? 8 * 1024 * 1024 : 15 * 1024 * 1024;
    if (!name || name.length > 180 || !url || !/^https:\/\//.test(url) || !publicId || publicId.length > 500 || !TASK_ATTACHMENT_TYPES.has(mimeType) || !Number.isInteger(bytes) || bytes < 1 || bytes > maxBytes) {
      throw badRequest('VALIDATION_ERROR', 'Salah satu lampiran tidak valid.', { attachments: 'Unggah ulang lampiran yang bermasalah.' });
    }
    return { name, url, publicId, mimeType, bytes };
  });
  return { textAnswer, attachments: cleaned };
}

export function validateGradeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Data penilaian tidak valid.');
  const status = text(input.status) || 'graded';
  const feedback = text(input.feedback);
  const score = input.score === '' || input.score === null || input.score === undefined ? null : Number(input.score);
  if (!['graded', 'returned'].includes(status)) throw badRequest('VALIDATION_ERROR', 'Status penilaian tidak valid.');
  if (status === 'graded' && (!Number.isInteger(score) || score < 0 || score > 100)) throw badRequest('VALIDATION_ERROR', 'Nilai harus berupa angka 0–100.', { score: 'Nilai wajib diisi.' });
  if (status === 'returned' && score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) throw badRequest('VALIDATION_ERROR', 'Nilai harus berupa angka 0–100.');
  if (feedback.length > 3000) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Umpan balik maksimal 3.000 karakter.');
  return { status, score, feedback };
}
