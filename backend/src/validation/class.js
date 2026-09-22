import { badRequest } from '../http/errors.js';

function cleanText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function validateCreateClass(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('INVALID_BODY', 'Data kelas tidak valid.');
  }

  const name = cleanText(input.name);
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const errors = {};

  if (name.length < 3) errors.name = 'Nama kelas minimal 3 karakter.';
  if (name.length > 80) errors.name = 'Nama kelas maksimal 80 karakter.';
  if (description.length > 400) errors.description = 'Deskripsi maksimal 400 karakter.';

  if (Object.keys(errors).length) {
    throw badRequest('VALIDATION_ERROR', 'Periksa kembali data kelas.', errors);
  }

  return { name, description };
}

export function validateJoinClass(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('INVALID_BODY', 'Data kode kelas tidak valid.');
  }

  const code = cleanText(input.code).toUpperCase();
  if (!/^[23456789A-HJ-NP-Z]{6}$/.test(code)) {
    throw badRequest('VALIDATION_ERROR', 'Periksa kembali kode kelas.', {
      code: 'Kode kelas harus terdiri dari 6 huruf atau angka.',
    });
  }
  return { code };
}

export function validateClassId(value) {
  if (typeof value !== 'string' || value.length > 64 || !/^[a-zA-Z0-9-]+$/.test(value)) {
    throw badRequest('INVALID_CLASS_ID', 'Identitas kelas tidak valid.');
  }
  return value;
}
