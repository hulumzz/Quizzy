import assert from 'node:assert/strict';
import test from 'node:test';
import { QuizRepository } from '../src/repositories/quiz-repository.js';

test('quiz review uses arrange and hotspot-specific correct answers', () => {
  const repository = new QuizRepository({ tableName: 'QuizzyTable', classRepository: {} });
  const quiz = {
    settings: { showCorrectAnswers: true },
    questions: [
      { id: 'arrange-1', type: 'arrange', prompt: 'Susun langkah', items: [{ id: 'a', text: 'Pertama' }, { id: 'b', text: 'Kedua' }], correctOrder: ['a', 'b'] },
      { id: 'hotspot-1', type: 'image_hotspot', prompt: 'Klik peta', hotspots: [{ id: 'java', label: 'Pulau Jawa', correct: true }] },
    ],
  };
  const attempt = { id: 'attempt-1', quizId: 'quiz-1', classId: 'class-1', score: 100, earnedPoints: 2, totalPoints: 2, passed: true, submittedAt: '2026-09-29T00:00:00.000Z', answers: [{ questionId: 'arrange-1', answer: ['b', 'a'] }, { questionId: 'hotspot-1', answer: { x: 50, y: 50 } }] };
  assert.deepEqual(repository.result(attempt, quiz).review, [
    { questionId: 'arrange-1', prompt: 'Susun langkah', answer: ['Kedua', 'Pertama'], correctAnswer: ['Pertama', 'Kedua'], explanation: '' },
    { questionId: 'hotspot-1', prompt: 'Klik peta', answer: { x: 50, y: 50 }, correctAnswer: 'Pulau Jawa', explanation: '' },
  ]);
});
