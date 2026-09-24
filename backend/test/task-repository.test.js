import assert from 'node:assert/strict';
import test from 'node:test';
import { TaskRepository } from '../src/repositories/task-repository.js';

const task = { entityType: 'TASK', id: 'task-1', classId: 'class-1', ownerId: 'teacher-1', status: 'published', dueAt: '2026-10-01T12:00:00.000Z', responseMode: 'both' };
const attachment = { name: 'jawaban.pdf', url: 'https://res.cloudinary.com/demo/raw/upload/jawaban.pdf', publicId: 'quizzy/classes/class-1/tasks/task-1/submissions/student-1/jawaban.pdf', mimeType: 'application/pdf', bytes: 1200 };
const classRepository = { async getForUser() { return { accessRole: 'member' }; } };

test('submission derives late status from the canonical deadline and preserves task folder ownership', async () => {
  let calls = 0; let written;
  const repository = new TaskRepository({ tableName: 'QuizzyTest', classRepository, documentClient: { async send(command) { calls += 1; if (calls === 1) return { Item: task }; if (calls === 2) return {}; written = command; return {}; } } });
  const result = await repository.submit({ classId: 'class-1', taskId: 'task-1', uid: 'student-1', studentName: 'Dina', textAnswer: 'Jawaban saya', attachments: [attachment], now: '2026-10-01T12:01:00.000Z' });
  assert.equal(result.late, true);
  assert.equal(written.input.Item.status, 'late');
  assert.equal(written.input.Item.studentId, 'student-1');
});

test('resubmission stores the prior answer as an immutable revision record', async () => {
  let calls = 0; let transaction;
  const previous = { ...task, entityType: 'TASK_SUBMISSION', taskId: 'task-1', classId: 'class-1', studentId: 'student-1', studentName: 'Dina', status: 'returned', submittedAt: '2026-09-30T10:00:00.000Z', attemptNumber: 1, attachments: [] };
  const repository = new TaskRepository({ tableName: 'QuizzyTest', classRepository, documentClient: { async send(command) { calls += 1; if (calls === 1) return { Item: task }; if (calls === 2) return { Item: previous }; transaction = command; return {}; } } });
  await repository.submit({ classId: 'class-1', taskId: 'task-1', uid: 'student-1', studentName: 'Dina', textAnswer: 'Revisi saya', attachments: [attachment], now: '2026-09-30T11:00:00.000Z' });
  assert.equal(transaction.input.TransactItems[0].Put.Item.entityType, 'TASK_SUBMISSION_REVISION');
  assert.equal(transaction.input.TransactItems[1].Put.Item.attemptNumber, 2);
});
