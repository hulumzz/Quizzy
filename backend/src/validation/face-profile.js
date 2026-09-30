import { badRequest } from '../http/errors.js';

const MIN_EMBEDDING_LENGTH = 64;
const MAX_EMBEDDING_LENGTH = 2048;
const MODEL_VERSION = 'human-v1';

export function validateFaceProfileInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('INVALID_BODY', 'Data profil wajah tidak valid.');
  }
  const errors = {};
  if (input.consent !== true) errors.consent = 'Persetujuan penggunaan profil wajah wajib diberikan.';
  if (input.modelVersion !== MODEL_VERSION) errors.modelVersion = 'Versi model profil wajah tidak didukung.';
  if (!Array.isArray(input.embedding) || input.embedding.length < MIN_EMBEDDING_LENGTH || input.embedding.length > MAX_EMBEDDING_LENGTH) {
    errors.embedding = `Embedding wajah harus berisi ${MIN_EMBEDDING_LENGTH}-${MAX_EMBEDDING_LENGTH} angka.`;
  } else if (input.embedding.some((value) => !Number.isFinite(value) || Math.abs(value) > 100)) {
    errors.embedding = 'Embedding wajah berisi nilai yang tidak valid.';
  }
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa kembali profil wajah.', errors);
  return {
    embedding: input.embedding.map((value) => Number(value.toFixed(8))),
    modelVersion: MODEL_VERSION,
  };
}
