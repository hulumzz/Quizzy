import assert from 'node:assert/strict';
import test from 'node:test';
import { AttendanceRepository, calculateDistanceMeters } from '../src/repositories/attendance-repository.js';

function classRepository(accessRole = 'owner') {
  return {
    async getForUser() { return { id: 'class-1', accessRole }; },
    async listMembers() { return [{ uid: 'student-1', name: 'Dina' }, { uid: 'student-2', name: 'Rafi' }]; },
  };
}

test('haversine distance is zero for identical points and realistic for nearby coordinates', () => {
  assert.equal(calculateDistanceMeters(-6.98, 109.64, -6.98, 109.64), 0);
  const distance = calculateDistanceMeters(-6.98, 109.64, -6.9805, 109.64);
  assert.ok(distance > 50 && distance < 60);
});

test('owner creates attendance as a draft with server ownership', async () => {
  let command;
  const documentClient = { async send(input) { command = input; return {}; } };
  const repository = new AttendanceRepository({ tableName: 'QuizzyTest', documentClient, classRepository: classRepository('owner') });
  const session = await repository.create({ classId: 'class-1', ownerId: 'teacher-1', title: 'Pertemuan 1', latitude: -6.98, longitude: 109.64, radiusMeters: 100, now: '2026-09-23T00:00:00.000Z' });
  assert.equal(command.input.Item.ownerId, 'teacher-1');
  assert.equal(command.input.Item.status, 'draft');
  assert.equal(session.status, 'draft');
});

test('student list hides drafts and attaches only their own check-in', async () => {
  const documentClient = { async send() { return { Items: [
    { entityType: 'ATTENDANCE', id: 'draft-1', classId: 'class-1', title: 'Draft', status: 'draft', latitude: 1, longitude: 1, radiusMeters: 100, createdAt: '2026-09-23T03:00:00Z', updatedAt: '2026-09-23T03:00:00Z' },
    { entityType: 'ATTENDANCE', id: 'active-1', classId: 'class-1', title: 'Aktif', status: 'active', latitude: 1, longitude: 1, radiusMeters: 100, createdAt: '2026-09-23T02:00:00Z', updatedAt: '2026-09-23T02:00:00Z' },
    { entityType: 'ATTENDANCE_CHECKIN', attendanceId: 'active-1', uid: 'student-1', name: 'Dina', distanceMeters: 12, checkedInAt: '2026-09-23T02:10:00Z' },
    { entityType: 'ATTENDANCE_CHECKIN', attendanceId: 'active-1', uid: 'student-2', name: 'Rafi', distanceMeters: 20, checkedInAt: '2026-09-23T02:11:00Z' },
  ] }; } };
  const repository = new AttendanceRepository({ tableName: 'QuizzyTest', documentClient, classRepository: classRepository('member') });
  const list = await repository.list('class-1', 'student-1');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'active-1');
  assert.equal(list[0].checkIn.uid, 'student-1');
  assert.equal(list[0].latitude, undefined);
  assert.equal(list[0].longitude, undefined);
});

test('check-in rejects users outside the configured server radius', async () => {
  let calls = 0;
  const documentClient = {
    async send() {
      calls += 1;
      if (calls === 1) return { Item: { entityType: 'ATTENDANCE', id: 'attendance-1', classId: 'class-1', status: 'active', latitude: -6.98, longitude: 109.64, radiusMeters: 50 } };
      return {};
    },
  };
  const repository = new AttendanceRepository({ tableName: 'QuizzyTest', documentClient, classRepository: classRepository('member') });
  await assert.rejects(
    () => repository.checkIn({ classId: 'class-1', attendanceId: 'attendance-1', uid: 'student-1', name: 'Dina', latitude: -6.99, longitude: 109.64, accuracyMeters: 10 }),
    (error) => error.statusCode === 422 && error.code === 'OUTSIDE_RADIUS' && error.details.distanceMeters > 50,
  );
});

test('successful check-in uses a transaction that rechecks active status', async () => {
  const commands = [];
  const documentClient = {
    async send(command) {
      commands.push(command);
      if (commands.length === 1) return { Item: { entityType: 'ATTENDANCE', id: 'attendance-1', classId: 'class-1', status: 'active', latitude: -6.98, longitude: 109.64, radiusMeters: 100 } };
      if (commands.length === 2) return {};
      return {};
    },
  };
  const repository = new AttendanceRepository({ tableName: 'QuizzyTest', documentClient, classRepository: classRepository('member') });
  const checkIn = await repository.checkIn({ classId: 'class-1', attendanceId: 'attendance-1', uid: 'student-1', name: 'Dina', latitude: -6.98, longitude: 109.64, accuracyMeters: 8, now: '2026-09-23T01:00:00Z' });
  const transaction = commands[2].input.TransactItems;
  assert.equal(transaction[0].ConditionCheck.ExpressionAttributeValues[':active'], 'active');
  assert.equal(transaction[1].Put.Item.uid, 'student-1');
  assert.equal(checkIn.status, 'present');
});

test('teacher detail returns present and absent recap', async () => {
  let calls = 0;
  const documentClient = {
    async send() {
      calls += 1;
      if (calls === 1) return { Item: { entityType: 'ATTENDANCE', id: 'attendance-1', classId: 'class-1', title: 'Pertemuan', status: 'ended', latitude: -6.98, longitude: 109.64, radiusMeters: 100, createdAt: '2026-09-23T00:00:00Z', updatedAt: '2026-09-23T01:00:00Z' } };
      return { Items: [{ entityType: 'ATTENDANCE_CHECKIN', attendanceId: 'attendance-1', uid: 'student-1', name: 'Dina', distanceMeters: 5, checkedInAt: '2026-09-23T00:15:00Z' }] };
    },
  };
  const repository = new AttendanceRepository({ tableName: 'QuizzyTest', documentClient, classRepository: classRepository('owner') });
  const detail = await repository.detail('class-1', 'attendance-1', 'teacher-1');
  assert.deepEqual(detail.summary, { totalMembers: 2, presentCount: 1, absentCount: 1 });
  assert.deepEqual(detail.recap.map((item) => item.status), ['present', 'absent']);
});
