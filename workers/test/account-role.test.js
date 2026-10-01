import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAccountRole } from '../src/services/account-role.js';
import { createD1Fixture } from './d1-fixture.js';

function profileResponse(uid, role, { name = 'Akun', email = 'akun@example.test' } = {}) {
  return new Response(JSON.stringify({ fields: {
    uid: { stringValue: uid },
    role: { stringValue: role },
    name: { stringValue: name },
    email: { stringValue: email },
  } }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('trusted account role is read from immutable Firebase profile then cached in D1', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return profileResponse('student-1', 'student', { name: 'Siswa Terverifikasi' }); };
  const identity = { uid: 'student-1', name: 'Token Name', email: 'student@example.test', signInProvider: 'password' };

  const first = await resolveAccountRole({ db: fixture.db, identity, authorization: 'Bearer token', projectId: 'quizzy-test', fetchImpl, now: '2026-10-01T00:00:00.000Z' });
  assert.equal(first, 'student');
  assert.equal(calls, 1);

  const row = fixture.sqlite.prepare('SELECT role,role_verified,role_verified_at,name FROM users WHERE id=?1').get('student-1');
  assert.equal(row.role, 'student');
  assert.equal(row.role_verified, 1);
  assert.equal(row.role_verified_at, '2026-10-01T00:00:00.000Z');
  assert.equal(row.name, 'Siswa Terverifikasi');

  const cached = await resolveAccountRole({
    db: fixture.db,
    identity,
    authorization: 'Bearer token',
    projectId: 'quizzy-test',
    fetchImpl: async () => { throw new Error('verified role should not re-read Firestore'); },
    now: '2026-10-01T01:00:00.000Z',
  });
  assert.equal(cached, 'student');
  assert.equal(calls, 1);
});

test('legacy D1 role is not trusted until Firebase profile verifies it', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  fixture.sqlite.prepare("UPDATE users SET role='teacher',role_verified=0 WHERE id='student-1'").run();
  const role = await resolveAccountRole({
    db: fixture.db,
    identity: { uid: 'student-1', signInProvider: 'password' },
    authorization: 'Bearer token',
    projectId: 'quizzy-test',
    fetchImpl: async () => profileResponse('student-1', 'student'),
  });
  assert.equal(role, 'student');
  assert.equal(fixture.sqlite.prepare("SELECT role_verified FROM users WHERE id='student-1'").get().role_verified, 1);
});

test('profile role must belong to the authenticated Firebase uid', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  await assert.rejects(
    () => resolveAccountRole({
      db: fixture.db,
      identity: { uid: 'student-1', signInProvider: 'password' },
      authorization: 'Bearer token',
      projectId: 'quizzy-test',
      fetchImpl: async () => profileResponse('other-user', 'teacher'),
    }),
    (error) => error?.status === 403,
  );
});

test('recreated Firestore profile cannot change a verified role after cache expires', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  fixture.sqlite.prepare("UPDATE users SET role_verified=1,role_verified_at='2026-09-01T00:00:00Z' WHERE id='student-1'").run();
  await assert.rejects(() => resolveAccountRole({
    db: fixture.db, identity: { uid: 'student-1', signInProvider: 'password' },
    authorization: 'Bearer token', projectId: 'quizzy-test',
    fetchImpl: async () => profileResponse('student-1', 'teacher'),
    now: '2026-10-02T00:00:00Z',
  }), { status: 403 });
  assert.equal(fixture.sqlite.prepare("SELECT role FROM users WHERE id='student-1'").get().role, 'student');
});

test('concurrent initial profile verification cannot overwrite the winning verified role', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  await assert.rejects(() => resolveAccountRole({
    db: fixture.db, identity: { uid: 'student-1', signInProvider: 'password' },
    authorization: 'Bearer token', projectId: 'quizzy-test',
    fetchImpl: async () => {
      fixture.sqlite.prepare("UPDATE users SET role_verified=1 WHERE id='student-1'").run();
      return profileResponse('student-1', 'teacher');
    },
  }), { status: 403 });
});
