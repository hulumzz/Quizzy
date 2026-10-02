import assert from 'node:assert/strict';
import test from 'node:test';
import { ClassRepository } from '../src/repositories/class.repository.js';
import { AttendanceRepository } from '../src/repositories/attendance.repository.js';
import { LearningSessionRepository } from '../src/repositories/learning-session.repository.js';
import { validateAttendanceInput, validateCheckIn } from '../src/validation/attendance.js';
import { createD1Fixture } from './d1-fixture.js';

function makeRepository(fixture) {
  const classes = new ClassRepository(fixture.db);
  const learningSessions = new LearningSessionRepository({ db: fixture.db, classRepository: classes });
  return new AttendanceRepository({ db: fixture.db, classRepository: classes, learningSessionRepository: learningSessions });
}

async function createActiveSession(repo, classId, ownerId, verificationMode, locationMode = 'online') {
  const now = new Date().toISOString();
  const session = await repo.create({ classId, ownerId, ...validateAttendanceInput({ title: `Sesi ${verificationMode}`, locationMode, verificationMode }), now });
  await repo.setStatus({ classId, attendanceId: session.id, ownerId, status: 'active', now });
  return session;
}

test('verification mode defaults and is returned in session serializer', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const repo = makeRepository(fixture);
  const session = await repo.create({ classId: 'class-1', ownerId: 'teacher-1', ...validateAttendanceInput({ title: 'Default', locationMode: 'online' }) });
  assert.equal(session.verificationMode, 'standard', 'default verificationMode harus standard');
  const face = await repo.create({ classId: 'class-1', ownerId: 'teacher-1', ...validateAttendanceInput({ title: 'Face', locationMode: 'online', verificationMode: 'face_required' }) });
  assert.equal(face.verificationMode, 'face_required');
});

test('enforcement matrix: standard session rejects face method', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const repo = makeRepository(fixture);
  const session = await createActiveSession(repo, 'class-1', 'teacher-1', 'standard');
  await assert.rejects(
    () => repo.checkIn({ classId: 'class-1', attendanceId: session.id, uid: 'student-1', name: 'Siswa', verificationMethod: 'face' }),
    { code: 'VERIFICATION_METHOD_NOT_ALLOWED' },
    'standard session harus menolak method face'
  );
});

test('enforcement matrix: standard session accepts standard method', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const repo = makeRepository(fixture);
  const session = await createActiveSession(repo, 'class-1', 'teacher-1', 'standard');
  const result = await repo.checkIn({ classId: 'class-1', attendanceId: session.id, uid: 'student-1', name: 'Siswa', verificationMethod: 'standard' });
  assert.equal(result.verificationMethod, 'standard');
});

test('enforcement matrix: face_optional accepts both standard and face', async (t) => {
  const fixture1 = createD1Fixture(); t.after(fixture1.close);
  const repo1 = makeRepository(fixture1);
  const s1 = await createActiveSession(repo1, 'class-1', 'teacher-1', 'face_optional');
  const r1 = await repo1.checkIn({ classId: 'class-1', attendanceId: s1.id, uid: 'student-1', name: 'Siswa', verificationMethod: 'standard' });
  assert.equal(r1.verificationMethod, 'standard', 'face_optional harus menerima standard');

  const fixture2 = createD1Fixture(); t.after(fixture2.close);
  const repo2 = makeRepository(fixture2);
  const s2 = await createActiveSession(repo2, 'class-1', 'teacher-1', 'face_optional');
  const r2 = await repo2.checkIn({ classId: 'class-1', attendanceId: s2.id, uid: 'student-1', name: 'Siswa', verificationMethod: 'face' });
  assert.equal(r2.verificationMethod, 'face', 'face_optional harus menerima face');
});

test('enforcement matrix: face_required rejects standard method', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const repo = makeRepository(fixture);
  const session = await createActiveSession(repo, 'class-1', 'teacher-1', 'face_required');
  await assert.rejects(
    () => repo.checkIn({ classId: 'class-1', attendanceId: session.id, uid: 'student-1', name: 'Siswa', verificationMethod: 'standard' }),
    { code: 'FACE_VERIFICATION_REQUIRED' },
    'face_required harus menolak standard'
  );
});

test('enforcement matrix: face_required accepts face method', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const repo = makeRepository(fixture);
  const session = await createActiveSession(repo, 'class-1', 'teacher-1', 'face_required');
  const result = await repo.checkIn({ classId: 'class-1', attendanceId: session.id, uid: 'student-1', name: 'Siswa', verificationMethod: 'face' });
  assert.equal(result.verificationMethod, 'face');
});

test('on-site face_required still rejects when outside GPS radius', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const repo = makeRepository(fixture);
  // Buat sesi on_site face_required — titik di Jakarta
  const session = await repo.create({
    classId: 'class-1', ownerId: 'teacher-1', ...validateAttendanceInput({ title: 'Onsite Face Required',
    locationMode: 'on_site', verificationMode: 'face_required',
    latitude: -6.2, longitude: 106.8, radiusMeters: 100 }),
  });
  await repo.setStatus({ classId: 'class-1', attendanceId: session.id, ownerId: 'teacher-1', status: 'active' });
  // Siswa coba check-in dengan face tapi GPS jauh (Yogyakarta)
  await assert.rejects(
    () => repo.checkIn({
      classId: 'class-1', attendanceId: session.id, uid: 'student-1', name: 'Siswa',
      verificationMethod: 'face', latitude: -7.8, longitude: 110.4,
    }),
    { code: 'OUTSIDE_RADIUS' },
    'face tidak boleh bypass validasi GPS radius'
  );
  await assert.rejects(
    () => repo.checkIn({ classId: 'class-1', attendanceId: session.id, uid: 'student-1', ...validateCheckIn({ verificationMethod: 'face' }) }),
    { code: 'LOCATION_REQUIRED' }
  );
  assert.equal(fixture.sqlite.prepare('SELECT COUNT(*) AS count FROM attendance_checkins').get().count, 0);
  const inside = await repo.checkIn({ classId: 'class-1', attendanceId: session.id, uid: 'student-1', ...validateCheckIn({ verificationMethod: 'face', latitude: -6.2, longitude: 106.8, accuracyMeters: 10 }) });
  assert.equal(inside.verificationMethod, 'face');
  assert.equal(inside.distanceMeters, 0);
  assert.equal(inside.accuracyMeters, 10);
});

test('D1 attendance preserves the first check-in method and exposes it in list, detail and recap', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const repo = makeRepository(fixture);
  const session = await createActiveSession(repo, 'class-1', 'teacher-1', 'face_optional');
  const first = await repo.checkIn({ classId: 'class-1', attendanceId: session.id, uid: 'student-1', name: 'Siswa', ...validateCheckIn({ verificationMethod: 'face' }) });
  const duplicate = await repo.checkIn({ classId: 'class-1', attendanceId: session.id, uid: 'student-1', name: 'Nama lain', ...validateCheckIn({}) });
  assert.deepEqual(duplicate, first);
  assert.equal(fixture.sqlite.prepare('SELECT COUNT(*) AS count FROM attendance_checkins').get().count, 1);
  const listed = (await repo.list('class-1', 'student-1'))[0];
  assert.equal(listed.verificationMode, 'face_optional');
  assert.deepEqual(listed.checkIn, first);
  assert.deepEqual((await repo.detail('class-1', session.id, 'student-1')).checkIn, first);
  const recap = await repo.detail('class-1', session.id, 'teacher-1');
  assert.equal(recap.verificationMode, 'face_optional');
  assert.deepEqual(recap.recap[0].checkIn, first);
  assert.equal(recap.summary.presentCount, 1);
});
