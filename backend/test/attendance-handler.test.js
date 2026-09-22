import assert from 'node:assert/strict';
import test from 'node:test';
import { createAttendanceHandler } from '../src/functions/attendance/handler.js';

function event(method, path, body) {
  return { rawPath: path, body: body === undefined ? undefined : JSON.stringify(body), requestContext: { http: { method }, requestId: 'request-attendance' } };
}

function setup(identity = { uid: 'teacher-1', name: 'Pak Guru', signInProvider: 'google.com' }) {
  const calls = [];
  const repository = {
    async list(classId, uid) { calls.push(['list', classId, uid]); return []; },
    async create(input) { calls.push(['create', input]); return { id: 'attendance-1', ...input, status: 'draft' }; },
    async detail(classId, attendanceId, uid) { calls.push(['detail', classId, attendanceId, uid]); return { id: attendanceId, classId }; },
    async setStatus(input) { calls.push(['status', input]); return { id: input.attendanceId, status: input.status }; },
    async checkIn(input) { calls.push(['checkin', input]); return { uid: input.uid, status: 'present' }; },
  };
  return { calls, handler: createAttendanceHandler({ authenticate: async () => identity, repository, logger: { error() {} } }) };
}

const sessionInput = { title: 'Pertemuan 1', latitude: -6.98, longitude: 109.64, radiusMeters: 100 };

test('attendance collection uses verified identity for list and create', async () => {
  const { calls, handler } = setup();
  assert.equal((await handler(event('GET', '/classes/class-1/attendance'))).statusCode, 200);
  assert.equal((await handler(event('POST', '/classes/class-1/attendance', { ...sessionInput, ownerId: 'attacker' }))).statusCode, 201);
  assert.deepEqual(calls[0], ['list', 'class-1', 'teacher-1']);
  assert.equal(calls[1][1].ownerId, 'teacher-1');
});

test('status changes and student check-in use server identity', async () => {
  const teacher = setup();
  assert.equal((await teacher.handler(event('PUT', '/classes/class-1/attendance/attendance-1/status', { status: 'active' }))).statusCode, 200);
  assert.equal(teacher.calls[0][1].ownerId, 'teacher-1');

  const student = setup({ uid: 'student-1', name: 'Dina', signInProvider: 'google.com' });
  assert.equal((await student.handler(event('POST', '/classes/class-1/attendance/attendance-1/check-in', { latitude: -6.98, longitude: 109.64, accuracyMeters: 14, uid: 'attacker' }))).statusCode, 200);
  assert.equal(student.calls[0][1].uid, 'student-1');
  assert.equal(student.calls[0][1].name, 'Dina');
});

test('anonymous attendance access is rejected', async () => {
  const { handler } = setup({ uid: 'guest-1', signInProvider: 'anonymous' });
  assert.equal((await handler(event('GET', '/classes/class-1/attendance'))).statusCode, 403);
});
