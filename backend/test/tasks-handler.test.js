import assert from 'node:assert/strict';
import test from 'node:test';
import { createTasksHandler } from '../src/functions/tasks/handler.js';

function event(method, path, body) { return { rawPath: path, body: body === undefined ? undefined : JSON.stringify(body), requestContext: { http: { method }, requestId: 'request-task' } }; }
function setup(identity = { uid: 'teacher-1', name: 'Ibu Nisa', signInProvider: 'google.com' }) {
  const calls = [];
  const repository = {
    async list(...input) { calls.push(['list', ...input]); return []; }, async create(input) { calls.push(['create', input]); return input; },
    async get(...input) { calls.push(['get', ...input]); return {}; }, async update(input) { calls.push(['update', input]); return input; },
    async prepareAttachmentUpload(input) { calls.push(['upload', input]); }, async submit(input) { calls.push(['submit', input]); return input; },
    async listSubmissions(input) { calls.push(['submissions', input]); return []; }, async grade(input) { calls.push(['grade', input]); return input; },
  };
  const signer = { async createTaskSubmissionSignature(input) { calls.push(['signature', input]); return { folder: 'test' }; } };
  return { calls, handler: createTasksHandler({ authenticate: async () => identity, repository, signer, logger: { error() {} } }) };
}
const task = { title: 'Refleksi Bab 1', instructions: '', dueAt: '2026-10-01T12:00:00.000Z', responseMode: 'both' };

test('task create and grade use the verified teacher identity', async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(event('POST', '/classes/class-1/tasks', { ...task, ownerId: 'attacker' }))).statusCode, 201);
  assert.equal(calls[0][1].ownerId, 'teacher-1');
  assert.equal((await handler(event('PUT', '/classes/class-1/tasks/task-1/submissions/student-1', { score: 88, feedback: 'Rapi.' }))).statusCode, 200);
  assert.equal(calls[1][1].ownerId, 'teacher-1');
});

test('student submission and upload signatures use the verified student identity', async () => {
  const { calls, handler } = setup({ uid: 'student-1', name: 'Dina', signInProvider: 'google.com' });
  assert.equal((await handler(event('POST', '/classes/class-1/tasks/task-1/uploads/signature', { fileName: 'jawaban.pdf', mimeType: 'application/pdf', size: 1000 }))).statusCode, 200);
  assert.equal(calls[0][1].uid, 'student-1');
  assert.equal(calls[1][1].uid, 'student-1');
  assert.equal((await handler(event('POST', '/classes/class-1/tasks/task-1/submission', { textAnswer: 'Saya sudah menjawab.', attachments: [] }))).statusCode, 200);
  assert.equal(calls[2][1].uid, 'student-1');
  assert.equal(calls[2][1].studentName, 'Dina');
});
