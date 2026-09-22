import { badRequest } from '../http/errors.js';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateDiscussionId(value, field = 'discussionId') {
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z0-9-]+$/.test(value)) {
    throw badRequest('INVALID_DISCUSSION_ID', 'Identitas diskusi tidak valid.', { [field]: 'Identitas diskusi tidak valid.' });
  }
  return value;
}

export function validateDiscussionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('INVALID_BODY', 'Data diskusi tidak valid.');
  }
  const content = cleanText(input.content);
  if (content.length < 2 || content.length > 3000) {
    throw badRequest('VALIDATION_ERROR', 'Periksa kembali pesan diskusi.', { content: 'Pesan harus terdiri dari 2–3.000 karakter.' });
  }
  return { content };
}

export function validateDiscussionStatus(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('INVALID_BODY', 'Data status diskusi tidak valid.');
  }
  const status = cleanText(input.status);
  if (!['open', 'resolved'].includes(status)) {
    throw badRequest('VALIDATION_ERROR', 'Periksa kembali status diskusi.', { status: 'Status harus open atau resolved.' });
  }
  const answerId = input.answerId === null || input.answerId === undefined || input.answerId === ''
    ? null
    : validateDiscussionId(input.answerId, 'answerId');
  if (status === 'open' && answerId) {
    throw badRequest('VALIDATION_ERROR', 'Diskusi terbuka tidak dapat memiliki jawaban terpilih.', { answerId: 'Buka kembali diskusi tanpa jawaban terpilih.' });
  }
  return { status, answerId };
}
