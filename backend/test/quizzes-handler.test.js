import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuizzesHandler } from '../src/functions/quizzes/handler.js';

const request = (method, path, body) => ({ rawPath: path, body: body === undefined ? undefined : JSON.stringify(body), requestContext: { http: { method }, requestId: 'quiz-request' } });
const quizInput = { title: 'Kuis pertama', status: 'draft', questions: [], settings: { passingScore: 70 } };
function setup(identity = { uid: 'teacher-1', signInProvider: 'google.com' }) {
  const calls = [];
  const repository = {
    async list(classId, uid) { calls.push(['list', classId, uid]); return []; },
    async create(input) { calls.push(['create', input]); return { id: 'quiz-1', ...input }; },
    async get(classId, quizId, uid) { calls.push(['get', classId, quizId, uid]); return { id: quizId }; },
    async update(input) { calls.push(['update', input]); return input; },
    async remove(classId, quizId, uid) { calls.push(['remove', classId, quizId, uid]); },
    async submit(input) { calls.push(['submit', input]); return { score: 100 }; },
    async getResult(classId, quizId, uid) { calls.push(['results', classId, quizId, uid]); return []; },
  };
  return { calls, handler: createQuizzesHandler({ authenticate: async () => identity, repository, logger: { error() {} } }) };
}

test('quiz collection uses verified identity for listing and ownership', async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(request('GET', '/classes/class-1/quizzes'))).statusCode, 200);
  assert.equal((await handler(request('POST', '/classes/class-1/quizzes', { ...quizInput, ownerId: 'attacker' }))).statusCode, 201);
  assert.deepEqual(calls[0], ['list', 'class-1', 'teacher-1']);
  assert.equal(calls[1][1].ownerId, 'teacher-1');
});

test('student submission ignores browser identity and maps results route', async () => {
  const { calls, handler } = setup({ uid: 'student-1', signInProvider: 'password' });
  assert.equal((await handler(request('POST', '/classes/class-1/quizzes/quiz-1/attempts', { studentId: 'attacker', answers: [{ questionId: 'q-1', answer: true }] }))).statusCode, 201);
  assert.equal((await handler(request('GET', '/classes/class-1/quizzes/quiz-1/results'))).statusCode, 200);
  assert.equal(calls[0][1].uid, 'student-1');
  assert.deepEqual(calls[1], ['results', 'class-1', 'quiz-1', 'student-1']);
});

test('anonymous quiz access is rejected', async () => {
  const { handler } = setup({ uid: 'guest', signInProvider: 'anonymous' });
  assert.equal((await handler(request('GET', '/classes/class-1/quizzes'))).statusCode, 403);
});
