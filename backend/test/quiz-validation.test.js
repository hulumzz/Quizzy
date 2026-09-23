import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAttempt, validateQuizInput } from '../src/validation/quiz.js';

test('quiz validation accepts supported questions and normalizes metadata', () => {
  const value = validateQuizInput({ title: '  Kuis   Biologi ', status: 'published', settings: { passingScore: 75 }, questions: [
    { id: 'one', type: 'multiple_choice', prompt: 'Bagian terkecil makhluk hidup?', choices: ['Sel', 'Jaringan'], correctAnswer: 'Sel', points: 2 },
    { id: 'two', type: 'true_false', prompt: 'Sel adalah unit kehidupan.', correctAnswer: true, points: 1 },
  ] });
  assert.equal(value.title, 'Kuis Biologi');
  assert.equal(value.mode, 'self_paced');
  assert.equal(value.questions.length, 2);
});

test('published quiz requires questions and a valid correct answer', () => {
  assert.throws(() => validateQuizInput({ title: 'Kuis kosong', status: 'published', questions: [] }), (error) => error.code === 'VALIDATION_ERROR' && Boolean(error.details.questions));
  assert.throws(() => validateQuizInput({ title: 'Kuis pilihan', status: 'published', questions: [{ type: 'multiple_choice', prompt: 'Pilih jawaban benar', choices: ['A', 'B'], correctAnswer: 'C' }] }), (error) => error.code === 'VALIDATION_ERROR' && Boolean(error.details['questions.0.correctAnswer']));
});

test('attempt validation keeps only question identity and supplied answer', () => {
  assert.deepEqual(validateAttempt({ answers: [{ questionId: 'q-1', answer: ' Sel ', correctAnswer: 'injected' }] }), { answers: [{ questionId: 'q-1', answer: 'Sel' }] });
});
