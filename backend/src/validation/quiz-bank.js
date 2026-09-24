import { badRequest } from '../http/errors.js';
import { quizLevelById, quizSubjectById } from '../domain/quiz-taxonomy.js';

const text = (value) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export function validateQuizBankCatalogId(value) {
  const id = text(value);
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) throw badRequest('INVALID_CATALOG_ID', 'Identitas kuis bank tidak valid.');
  return id;
}

export function validateQuizBankPublish(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Data publikasi kuis tidak valid.');
  const sourceType = text(input.sourceType) || 'class'; const classId = text(input.classId); const quizId = text(input.quizId); const level = text(input.level); const subjectId = text(input.subjectId);
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map(text).filter(Boolean).filter((tag) => tag.length <= 32))].slice(0, 8) : [];
  const license = text(input.license) || 'atribusi';
  const errors = {};
  if (!['class', 'general'].includes(sourceType)) errors.sourceType = 'Sumber kuis tidak valid.';
  if (sourceType === 'class' && !/^[A-Za-z0-9-]{1,64}$/.test(classId)) errors.classId = 'Kelas tidak valid.';
  if (!/^[A-Za-z0-9-]{1,64}$/.test(quizId)) errors.quizId = 'Kuis tidak valid.';
  if (!quizLevelById(level)) errors.level = 'Jenjang belum dipilih.';
  if (!quizSubjectById(subjectId)) errors.subjectId = 'Mata pelajaran belum dipilih.';
  if (!['atribusi', 'bebas-digunakan'].includes(license)) errors.license = 'Lisensi tidak valid.';
  if (Object.keys(errors).length) throw badRequest('VALIDATION_ERROR', 'Periksa data publikasi kuis.', errors);
  return { sourceType, ...(sourceType === 'class' ? { classId } : {}), quizId, level, subjectId, tags, license };
}

export function validateQuizBankQuery(query = {}) {
  const level = text(query.level) || 'all'; const subjectId = text(query.subject) || 'all';
  if (level !== 'all' && !quizLevelById(level)) throw badRequest('INVALID_LEVEL', 'Jenjang filter tidak valid.');
  if (subjectId !== 'all' && !quizSubjectById(subjectId)) throw badRequest('INVALID_SUBJECT', 'Mata pelajaran filter tidak valid.');
  return { level, subjectId };
}

export function validateQuizBankCopy(input) {
  const classId = text(input?.classId);
  if (!/^[A-Za-z0-9-]{1,64}$/.test(classId)) throw badRequest('VALIDATION_ERROR', 'Kelas tujuan tidak valid.', { classId: 'Pilih kelas tujuan.' });
  return { classId };
}
