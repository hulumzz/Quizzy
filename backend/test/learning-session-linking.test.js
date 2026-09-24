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


test('existing material can still be edited after its learning session is archived', async () => {
  let guardCalls = 0;
  const calls = [];
  const repository = new MaterialRepository({
    tableName: 'QuizzyTable',
    classRepository: ownerClassRepository,
    learningSessionRepository: { async requireAssignable() { guardCalls += 1; throw new Error('archived'); } },
    documentClient: {
      async send(command) {
        calls.push(command);
        if (calls.length === 1) {
          return {
            Item: {
              PK: 'CLASS#class-1',
              SK: 'MATERIAL#material-1',
              entityType: 'MATERIAL',
              id: 'material-1',
              classId: 'class-1',
              ownerId: 'teacher-1',
              title: 'Materi lama',
              summary: '',
              status: 'draft',
              blocks: [],
              sessionId: 'session-archived',
              createdAt: '2026-09-20T00:00:00.000Z',
              updatedAt: '2026-09-20T00:00:00.000Z',
            },
          };
        }
        return {};
      },
    },
  });

  const updated = await repository.update({
    classId: 'class-1',
    materialId: 'material-1',
    ownerId: 'teacher-1',
    title: 'Materi diperbarui',
    summary: '',
    status: 'draft',
    blocks: [],
    sessionId: 'session-archived',
    now: '2026-09-24T10:00:00.000Z',
  });

  assert.equal(guardCalls, 0);
  assert.equal(updated.sessionId, 'session-archived');
  assert.equal(calls[1].input.Item.sessionId, 'session-archived');
});

test('moving an existing quiz to another learning session still requires assignment validation', async () => {
  const seen = [];
  const calls = [];
  const repository = new QuizRepository({
    tableName: 'QuizzyTable',
    classRepository: ownerClassRepository,
    learningSessionRepository: sessionGuard(seen),
    documentClient: {
      async send(command) {
        calls.push(command);
        if (calls.length === 1) {
          return {
            Item: {
              PK: 'CLASS#class-1',
              SK: 'QUIZ#quiz-1',
              entityType: 'QUIZ',
              id: 'quiz-1',
              classId: 'class-1',
              ownerId: 'teacher-1',
              title: 'Kuis lama',
              description: '',
              status: 'draft',
              mode: 'self_paced',
              questions: [],
              settings: { shuffleQuestions: false, showCorrectAnswers: true, passingScore: 70 },
              sessionId: 'session-old',
              createdAt: '2026-09-20T00:00:00.000Z',
              updatedAt: '2026-09-20T00:00:00.000Z',
            },
          };
        }
        return {};
      },
    },
  });

  const updated = await repository.update({
    classId: 'class-1',
    quizId: 'quiz-1',
    ownerId: 'teacher-1',
    title: 'Kuis pindah',
    description: '',
    status: 'draft',
    mode: 'self_paced',
    questions: [],
    settings: { shuffleQuestions: false, showCorrectAnswers: true, passingScore: 70 },
    sessionId: 'session-new',
    now: '2026-09-24T10:00:00.000Z',
  });

  assert.deepEqual(seen, [{ classId: 'class-1', sessionId: 'session-new', ownerId: 'teacher-1' }]);
  assert.equal(updated.sessionId, 'session-new');
  assert.equal(calls[1].input.Item.sessionId, 'session-new');
});
