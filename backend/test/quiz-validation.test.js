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

test('quiz validation accepts arranged and image hotspot questions with a bounded tolerance', () => {
  const value = validateQuizInput({ title: 'Kuis interaktif', status: 'published', questions: [
    { id: 'order', type: 'arrange', prompt: 'Susun daur air.', items: [{ id: 'a', text: 'Menguap' }, { id: 'b', text: 'Mengembun' }, { id: 'c', text: 'Hujan' }], correctOrder: ['a', 'b', 'c'] },
    { id: 'map', type: 'image_hotspot', prompt: 'Klik Indonesia.', imageUrl: 'https://cdn.example.test/map.png', tolerancePercent: 3, hotspots: [{ id: 'indonesia', label: 'Indonesia', x: 35, y: 40, width: 20, height: 15, correct: true }] },
  ] });
  assert.equal(value.questions[0].correctOrder[1], 'b');
  assert.equal(value.questions[1].hotspots[0].correct, true);
  assert.deepEqual(validateAttempt({ answers: [{ questionId: 'order', answer: ['a', 'b', 'c'] }, { questionId: 'map', answer: { x: 40, y: 45 } }] }).answers[1].answer, { x: 40, y: 45 });
});
