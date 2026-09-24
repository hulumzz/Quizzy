import assert from 'node:assert/strict';
import test from 'node:test';
import { AttendanceRepository } from '../src/repositories/attendance-repository.js';
import { MaterialRepository } from '../src/repositories/material-repository.js';
import { QuizRepository } from '../src/repositories/quiz-repository.js';

const ownerClassRepository = {
  async getForUser() {
    return { accessRole: 'owner' };
  },
};

function sessionGuard(seen) {
  return {
    async requireAssignable(classId, sessionId, ownerId) {
      seen.push({ classId, sessionId, ownerId });
      return { id: sessionId, classId, status: 'published' };
    },
  };
}

test('material creation validates and persists the selected learning session', async () => {
  const seen = [];
  const calls = [];
  const repository = new MaterialRepository({
    tableName: 'QuizzyTable',
    classRepository: ownerClassRepository,
    learningSessionRepository: sessionGuard(seen),
    documentClient: { async send(command) { calls.push(command); return {}; } },
  });

  const material = await repository.create({
    classId: 'class-1',
    ownerId: 'teacher-1',
    title: 'Materi',
    summary: '',
    status: 'draft',
    blocks: [],
    sessionId: 'session-1',
    now: '2026-09-24T10:00:00.000Z',
  });

  assert.deepEqual(seen, [{ classId: 'class-1', sessionId: 'session-1', ownerId: 'teacher-1' }]);
  assert.equal(calls[0].input.TransactItems[0].Put.Item.sessionId, 'session-1');
  assert.equal(material.sessionId, 'session-1');
});

test('class quiz creation validates and persists the selected learning session', async () => {
  const seen = [];
  const calls = [];
  const repository = new QuizRepository({
    tableName: 'QuizzyTable',
    classRepository: ownerClassRepository,
    learningSessionRepository: sessionGuard(seen),
    documentClient: { async send(command) { calls.push(command); return {}; } },
  });

  const quiz = await repository.create({
    classId: 'class-1',
    ownerId: 'teacher-1',
    title: 'Kuis',
    description: '',
    status: 'draft',
    mode: 'self_paced',
    questions: [],
    settings: { shuffleQuestions: false, showCorrectAnswers: true, passingScore: 70 },
    sessionId: 'session-2',
    now: '2026-09-24T10:00:00.000Z',
  });

  assert.deepEqual(seen, [{ classId: 'class-1', sessionId: 'session-2', ownerId: 'teacher-1' }]);
  assert.equal(calls[0].input.TransactItems[0].Put.Item.sessionId, 'session-2');
  assert.equal(quiz.sessionId, 'session-2');
});

test('attendance creation validates and persists the selected learning session while legacy unassigned remains valid', async () => {
  const seen = [];
  const calls = [];
  const repository = new AttendanceRepository({
    tableName: 'QuizzyTable',
    classRepository: ownerClassRepository,
    learningSessionRepository: sessionGuard(seen),
    documentClient: { async send(command) { calls.push(command); return {}; } },
  });

  const linked = await repository.create({
    classId: 'class-1',
    ownerId: 'teacher-1',
    title: 'Presensi pertemuan',
    latitude: -6.9,
    longitude: 109.6,
    radiusMeters: 100,
    sessionId: 'session-3',
    now: '2026-09-24T10:00:00.000Z',
  });
  const legacy = await repository.create({
    classId: 'class-1',
    ownerId: 'teacher-1',
    title: 'Presensi lama',
    latitude: -6.9,
    longitude: 109.6,
    radiusMeters: 100,
    now: '2026-09-24T10:01:00.000Z',
  });

  assert.equal(linked.sessionId, 'session-3');
  assert.equal(legacy.sessionId, null);
  assert.equal(seen.length, 1);
  assert.equal(calls[0].input.Item.sessionId, 'session-3');
  assert.equal(calls[1].input.Item.sessionId, undefined);
});
