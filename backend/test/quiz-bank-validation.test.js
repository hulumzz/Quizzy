import assert from 'node:assert/strict';
import test from 'node:test';
import { validateQuizBankPublish, validateQuizBankQuery } from '../src/validation/quiz-bank.js';

test('quiz bank publication only accepts stable taxonomy identifiers', () => {
  const value = validateQuizBankPublish({ classId: 'class-1', quizId: 'quiz-1', level: 'smp', subjectId: 'informatika', tags: [' algoritma ', 'algoritma', 'logika'], license: 'atribusi' });
  assert.deepEqual(value.tags, ['algoritma', 'logika']);
  assert.equal(value.subjectId, 'informatika');
  assert.throws(() => validateQuizBankPublish({ classId: 'class-1', quizId: 'quiz-1', level: 'kelas-8', subjectId: 'bebas' }), (error) => error.code === 'VALIDATION_ERROR');
});

test('general quiz publication does not require a class identifier', () => {
  const value = validateQuizBankPublish({ sourceType: 'general', quizId: 'quiz-1', level: 'umum', subjectId: 'umum' });
  assert.equal(value.sourceType, 'general');
  assert.equal(value.classId, undefined);
});

test('quiz bank filter defaults to all without allowing arbitrary filters', () => {
  assert.deepEqual(validateQuizBankQuery({}), { level: 'all', subjectId: 'all' });
  assert.throws(() => validateQuizBankQuery({ subject: 'mata-pelajaran-baru' }), (error) => error.code === 'INVALID_SUBJECT');
});
