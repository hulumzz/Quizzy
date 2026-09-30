import { badRequest } from '../http/errors.js';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const NAME_PATTERN = /^[\p{L}\p{N} .,'-]+$/u;

function clean(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeAnswer(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return clean(value);
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).slice(0, 12);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const x = Number(value.x); const y = Number(value.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return '';
}

export function validateLiveCode(value) {
  const code = clean(value).toUpperCase();
  if (code.length !== 6 || [...code].some((character) => !CODE_ALPHABET.includes(character))) {
    throw badRequest('INVALID_LIVE_CODE', 'Kode kuis harus terdiri dari 6 karakter.');
  }
  return code;
}

export function validateParticipantName(value) {
  const name = clean(value);
  if (name.length < 2 || name.length > 60 || !NAME_PATTERN.test(name)) {
    throw badRequest('INVALID_PARTICIPANT_NAME', 'Nama peserta harus terdiri dari 2-60 karakter.');
  }
  return name;
}

export function validateLiveSessionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { questionDurationSeconds: 30 };
  const questionDurationSeconds = Number(input.questionDurationSeconds ?? 30);
  if (!Number.isInteger(questionDurationSeconds) || questionDurationSeconds < 5 || questionDurationSeconds > 300) {
    throw badRequest('VALIDATION_ERROR', 'Durasi setiap soal harus 5-300 detik.', { questionDurationSeconds: 'Gunakan angka bulat 5-300.' });
  }
  return { questionDurationSeconds };
}

export function validateLiveJoin(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Nama peserta wajib diisi.');
  return { name: validateParticipantName(input.name) };
}

export function validateLiveAnswer(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Jawaban kuis tidak valid.');
  const participantId = clean(input.participantId);
  const participantToken = clean(input.participantToken);
  const questionId = clean(input.questionId);
  const answer = normalizeAnswer(input.answer);
  const errors = {};
  if (!/^[A-Za-z0-9-]{1,64}$/.test(participantId)) errors.participantId = 'Peserta tidak valid.';
  if (!/^[a-f0-9]{64}$/.test(participantToken)) errors.participantToken = 'Sesi peserta tidak valid.';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(questionId)) errors.questionId = 'Soal tidak valid.';
  if (typeof answer === 'string' && answer.length > 300) errors.answer = 'Jawaban terlalu panjang.';
  if (Array.isArray(answer) && (answer.length > 10 || answer.some((item) => item.length > 64))) errors.answer = 'Susunan jawaban tidak valid.';
  if (answer && typeof answer === 'object' && !Array.isArray(answer) && (answer.x < 0 || answer.x > 100 || answer.y < 0 || answer.y > 100)) errors.answer = 'Titik pilihan harus berada di dalam gambar.';
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa jawaban Anda.', errors);
  return { participantId, participantToken, questionId, answer };
}

export function validateLiveParticipantSession(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Sesi peserta tidak valid.');
  const participantId = clean(input.participantId);
  const participantToken = clean(input.participantToken);
  const errors = {};
  if (!/^[A-Za-z0-9-]{1,64}$/.test(participantId)) errors.participantId = 'Peserta tidak valid.';
  if (!/^[a-f0-9]{64}$/.test(participantToken)) errors.participantToken = 'Sesi peserta tidak valid.';
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Sesi peserta tidak valid.', errors);
  return { participantId, participantToken };
}

export function validateLiveAction(input) {
  const action = clean(input?.action);
  if (!['advance', 'finish'].includes(action)) throw badRequest('INVALID_LIVE_ACTION', 'Aksi sesi tidak valid.');
  return { action };
}
