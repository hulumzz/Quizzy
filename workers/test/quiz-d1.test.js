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
  assert.deepEqual((await repository.get('class-1', quiz.id, 'student-1')).questions[0].items.map((item) => item.id).sort(), ['a', 'b', 'c']);
  const submitted = await repository.submit({ classId: 'class-1', quizId: quiz.id, uid: 'student-1', answers: [{ questionId: 'q1', answer: ['a', 'c', 'b'] }] });
  assert.deepEqual(submitted.review[0].answer, ['Awal', 'Tutup', 'Akhir']);
  assert.deepEqual(submitted.review[0].correctAnswer, ['Awal', 'Akhir', 'Tutup']);
  const listedForStudent = await repository.list('class-1', 'student-1');
  assert.equal(listedForStudent[0].attempt.score, submitted.score);
  assert.equal(listedForStudent[0].attempt.submittedAt, submitted.submittedAt);
  assert.deepEqual((await repository.getResult('class-1', quiz.id, 'student-1')).review, submitted.review);
  assert.equal((await repository.getResult('class-1', quiz.id, 'teacher-1'))[0].studentName, 'Siswa');
  assert.equal((await repository.exportForOwner('class-1', quiz.id, 'teacher-1')).quiz.status, 'draft');
  const changed = { ...input, questions: input.questions.map((q) => ({ ...q, correctOrder: ['c', 'b', 'a'] })) };
  await assert.rejects(() => repository.update({ classId: 'class-1', quizId: quiz.id, ownerId: 'teacher-1', ...changed }), { code: 'QUIZ_HAS_ATTEMPTS' });
  await repository.update({ classId: 'class-1', quizId: quiz.id, ownerId: 'teacher-1', ...input, title: 'Judul diperbarui' });
  assert.deepEqual((await repository.getResult('class-1', quiz.id, 'student-1')).review, submitted.review);
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

test('D1 quiz snapshots the trusted member name across membership rename and removal', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const repository = new QuizRepository({ db: fixture.db, classRepository: new ClassRepository(fixture.db) });
  const quiz = await repository.create({ classId: 'class-1', ownerId: 'teacher-1', ...validateQuizInput({
    title: 'Histori nama', status: 'published',
    questions: [{ id: 'q1', type: 'true_false', prompt: 'Benar?', points: 1, correctAnswer: true }],
  }) });
  const submitted = await repository.submit({ classId: 'class-1', quizId: quiz.id, uid: 'student-1', studentName: 'Nama dari browser', answers: [{ questionId: 'q1', answer: true }] });
  const stored = fixture.sqlite.prepare('SELECT student_name FROM quiz_attempts WHERE id = ?1').get(submitted.id);
  assert.equal(stored.student_name, 'Siswa');
  const before = (await repository.getResult('class-1', quiz.id, 'teacher-1'))[0];
  assert.equal(before.studentName, 'Siswa');
  await fixture.db.prepare('UPDATE class_members SET name = ?3 WHERE class_id = ?1 AND user_id = ?2').bind('class-1', 'student-1', 'Nama baru').run();
  assert.deepEqual((await repository.getResult('class-1', quiz.id, 'teacher-1'))[0], before);
  await fixture.db.prepare('DELETE FROM class_members WHERE class_id = ?1 AND user_id = ?2').bind('class-1', 'student-1').run();
  assert.deepEqual((await repository.getResult('class-1', quiz.id, 'teacher-1'))[0], before);
});

test('D1 quiz reads legacy attempts with empty snapshots using member and unknown fallbacks', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const repository = new QuizRepository({ db: fixture.db, classRepository: new ClassRepository(fixture.db) });
  const quiz = await repository.create({ classId: 'class-1', ownerId: 'teacher-1', ...validateQuizInput({
    title: 'Histori lama', status: 'published',
    questions: [{ id: 'q1', type: 'true_false', prompt: 'Benar?', points: 1, correctAnswer: true }],
  }) });
  const submitted = await repository.submit({ classId: 'class-1', quizId: quiz.id, uid: 'student-1', answers: [{ questionId: 'q1', answer: true }] });
  for (const snapshot of [null, '']) {
    await fixture.db.prepare('UPDATE quiz_attempts SET student_name = ?2 WHERE id = ?1').bind(submitted.id, snapshot).run();
    assert.equal((await repository.getResult('class-1', quiz.id, 'teacher-1'))[0].studentName, 'Siswa');
    assert.deepEqual(await repository.getResult('class-1', quiz.id, 'student-1'), submitted);
  }
  await fixture.db.prepare('DELETE FROM class_members WHERE class_id = ?1 AND user_id = ?2').bind('class-1', 'student-1').run();
  assert.equal((await repository.getResult('class-1', quiz.id, 'teacher-1'))[0].studentName, 'Siswa tidak diketahui');
});
