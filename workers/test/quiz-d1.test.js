import assert from 'node:assert/strict';
import test from 'node:test';
import { ClassRepository } from '../src/repositories/class.repository.js';
import { QuizRepository } from '../src/repositories/quiz.repository.js';
import { validateQuizInput } from '../src/validation/quizzes.js';
import { createD1Fixture } from './d1-fixture.js';

test('D1 quiz preserves immediate and fetched review and owner export', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const classes = new ClassRepository(fixture.db);
  const repository = new QuizRepository({ db: fixture.db, classRepository: classes });
  const input = validateQuizInput({
    title: 'Latihan', status: 'published', settings: { showCorrectAnswers: true },
    questions: [{ id: 'q1', type: 'arrange', prompt: 'Urutkan langkah', points: 2,
      items: [{ id: 'a', text: 'Awal' }, { id: 'b', text: 'Akhir' }, { id: 'c', text: 'Tutup' }],
      correctOrder: ['a', 'b', 'c'], explanation: 'Ikuti urutan.' }],
  });
  const quiz = await repository.create({ classId: 'class-1', ownerId: 'teacher-1', ...input });
  assert.equal((await repository.get('class-1', quiz.id, 'student-1')).questions[0].correctOrder, undefined);
  assert.deepEqual((await repository.get('class-1', quiz.id, 'student-1')).questions[0].items.map((item) => item.id), ['b', 'c', 'a']);
  const submitted = await repository.submit({ classId: 'class-1', quizId: quiz.id, uid: 'student-1', answers: [{ questionId: 'q1', answer: ['a', 'c', 'b'] }] });
  assert.deepEqual(submitted.review[0].answer, ['Awal', 'Tutup', 'Akhir']);
  assert.deepEqual(submitted.review[0].correctAnswer, ['Awal', 'Akhir', 'Tutup']);
  assert.deepEqual((await repository.getResult('class-1', quiz.id, 'student-1')).review, submitted.review);
  assert.equal((await repository.getResult('class-1', quiz.id, 'teacher-1'))[0].studentName, 'Siswa');
  assert.equal((await repository.exportForOwner('class-1', quiz.id, 'teacher-1')).quiz.status, 'draft');
  await assert.rejects(() => repository.exportForOwner('class-1', quiz.id, 'student-1'), { code: 'FORBIDDEN' });
});


test('D1 quiz keeps hotspot geometry private and rejects duplicate choices', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const classes = new ClassRepository(fixture.db);
  const repository = new QuizRepository({ db: fixture.db, classRepository: classes });

  assert.throws(() => validateQuizInput({
    title: 'Duplikat', status: 'published',
    questions: [{ id: 'q1', type: 'multiple_choice', prompt: 'Pilih satu', points: 1, choices: ['A', 'A'], correctAnswer: 'A' }],
  }), { code: 'VALIDATION_ERROR' });

  const input = validateQuizInput({
    title: 'Hotspot', status: 'published',
    questions: [{ id: 'q1', type: 'image_hotspot', prompt: 'Klik target', points: 2,
      imageUrl: 'https://example.com/target.png', tolerancePercent: 2,
      hotspots: [{ id: 'target', label: 'Target', x: 20, y: 25, width: 15, height: 20, correct: true }] }],
  });
  const quiz = await repository.create({ classId: 'class-1', ownerId: 'teacher-1', ...input });
  const studentQuiz = await repository.get('class-1', quiz.id, 'student-1');
  assert.equal(studentQuiz.questions[0].imageUrl, 'https://example.com/target.png');
  assert.equal(studentQuiz.questions[0].hotspots, undefined);
  assert.equal(studentQuiz.questions[0].tolerancePercent, undefined);
  const submitted = await repository.submit({ classId: 'class-1', quizId: quiz.id, uid: 'student-1', answers: [{ questionId: 'q1', answer: { x: 25, y: 30 } }] });
  assert.equal(submitted.score, 100);
  assert.equal(submitted.review[0].correctAnswer, 'Target');
});
