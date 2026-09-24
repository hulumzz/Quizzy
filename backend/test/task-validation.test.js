import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGradeInput, validateSubmissionInput, validateTaskInput } from '../src/validation/task.js';

const dueAt = '2026-10-01T12:00:00.000Z';

test('task validation keeps the agreed answer modes and deadline', () => {
  const task = validateTaskInput({ title: 'Refleksi Bab 1', instructions: 'Tulis jawabanmu.', dueAt, responseMode: 'both' });
  assert.equal(task.status, 'published');
  assert.equal(task.responseMode, 'both');
  assert.throws(() => validateTaskInput({ title: 'x', dueAt, responseMode: 'voice' }), (error) => error.code === 'VALIDATION_ERROR');
});

test('submission validation bounds attachment count and grade is 0 to 100', () => {
  const attachment = { name: 'jawaban.pdf', url: 'https://res.cloudinary.com/demo/raw/upload/jawaban.pdf', publicId: 'quizzy/classes/class-1/tasks/task-1/submissions/student-1/jawaban', mimeType: 'application/pdf', bytes: 2048 };
  assert.equal(validateSubmissionInput({ textAnswer: 'Jawaban', attachments: [attachment] }).attachments.length, 1);
  assert.equal(validateGradeInput({ score: 86, feedback: 'Bagus.' }).score, 86);
  assert.throws(() => validateGradeInput({ score: 101 }), (error) => error.code === 'VALIDATION_ERROR');
});
