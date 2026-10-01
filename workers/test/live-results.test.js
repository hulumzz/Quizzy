import assert from 'node:assert/strict';
import test from 'node:test';
import { ClassRepository } from '../src/repositories/class.repository.js';
import { LiveResultRepository, liveResultCsv, persistLiveResultSnapshot } from '../src/repositories/live-result.repository.js';
import { createD1Fixture } from './d1-fixture.js';

test('Live result snapshot persists idempotently and remains reportable', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const snapshot = {
    id: 'ABC234',
    code: 'ABC234',
    scope: 'class',
    classId: 'class-1',
    learningSessionId: null,
    quizId: 'quiz-live-1',
    ownerId: 'teacher-1',
    title: 'Live Aljabar',
    questions: [{ id: 'q1', type: 'multiple_choice', prompt: '2 + 2?', points: 5 }],
    questionCount: 1,
    totalPoints: 5,
    participantCount: 1,
    startedAt: '2026-10-01T01:00:00.000Z',
    finishedAt: '2026-10-01T01:05:00.000Z',
    createdAt: '2026-10-01T00:59:00.000Z',
    participants: [{ id: 'p1', studentId: 'student-1', name: 'Siswa', score: 5, correctCount: 1, rank: 1, joinedAt: '2026-10-01T01:00:10.000Z' }],
    answers: [{ questionId: 'q1', participantId: 'p1', studentId: 'student-1', correct: true, earnedPoints: 5, answeredAt: '2026-10-01T01:02:00.000Z' }],
  };

  await persistLiveResultSnapshot(fixture.db, snapshot);
  await persistLiveResultSnapshot(fixture.db, { ...snapshot, participantCount: 1 });

  const repository = new LiveResultRepository({ db: fixture.db, classRepository: new ClassRepository(fixture.db) });
  const sessions = await repository.listClass('class-1', 'teacher-1');
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, 'ABC234');

  const detail = await repository.getClass('class-1', 'ABC234', 'teacher-1');
  assert.equal(detail.participants[0].studentId, 'student-1');
  assert.equal(detail.questions[0].accuracy, 100);
  assert.equal(detail.questions[0].correctCount, 1);
  assert.match(liveResultCsv(detail), /Siswa/);
  assert.match(liveResultCsv(detail), /student-1/);
});

test('class Live reports remain owner-only', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const repository = new LiveResultRepository({ db: fixture.db, classRepository: new ClassRepository(fixture.db) });
  await assert.rejects(() => repository.listClass('class-1', 'student-1'), (error) => error?.status === 403);
});
