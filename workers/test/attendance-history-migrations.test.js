import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ClassRepository } from '../src/repositories/class.repository.js';
import { AttendanceRepository } from '../src/repositories/attendance.repository.js';
import { QuizRepository } from '../src/repositories/quiz.repository.js';
import { createD1Fixture } from './d1-fixture.js';

test('D1 migrations 0013 and 0014 preserve historical attendance and backfill available quiz names', async (t) => {
  const fixture = createD1Fixture({ throughMigration: '0012_live_result_completion.sql' });
  t.after(fixture.close);
  const { sqlite } = fixture;
  const now = '2026-10-03T00:00:00.000Z';
  sqlite.prepare(`INSERT INTO attendance_sessions (id,class_id,owner_id,title,location_mode,status,created_at,updated_at)
    VALUES ('old-session','class-1','teacher-1','Presensi lama','online','ended',?1,?1)`).run(now);
  sqlite.prepare(`INSERT INTO attendance_checkins (attendance_id,user_id,class_id,name,checked_in_at)
    VALUES ('old-session','student-1','class-1','Siswa',?1)`).run(now);
  sqlite.prepare(`INSERT INTO quizzes (id,class_id,owner_id,title,status,questions_json,settings_json,created_at,updated_at)
    VALUES ('old-quiz','class-1','teacher-1','Kuis lama','published','[]','{}',?1,?1)`).run(now);
  sqlite.prepare(`INSERT INTO users (id,name,role,created_at,updated_at)
    VALUES ('former-student','Mantan siswa','student',?1,?1)`).run(now);
  const insertAttempt = sqlite.prepare(`INSERT INTO quiz_attempts (id,quiz_id,class_id,student_id,answers_json,score,earned_points,total_points,passed,submitted_at)
    VALUES (?1,'old-quiz','class-1',?2,'[]',100,1,1,1,?3)`);
  insertAttempt.run('old-attempt-member', 'student-1', now);
  insertAttempt.run('old-attempt-former', 'former-student', now);

  for (const filename of ['0013_attendance_verification.sql', '0014_quiz_attempt_student_name.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${filename}`, import.meta.url), 'utf8'));
  }
  assert.equal(sqlite.prepare('SELECT verification_mode FROM attendance_sessions').get().verification_mode, 'standard');
  assert.equal(sqlite.prepare('SELECT verification_method FROM attendance_checkins').get().verification_method, 'standard');
  assert.equal(sqlite.prepare("SELECT student_name FROM quiz_attempts WHERE id='old-attempt-member'").get().student_name, 'Siswa');
  assert.equal(sqlite.prepare("SELECT student_name FROM quiz_attempts WHERE id='old-attempt-former'").get().student_name, null);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM quiz_attempts').get().count, 2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM attendance_checkins').get().count, 1);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(), []);

  const classes = new ClassRepository(fixture.db);
  const attendance = await new AttendanceRepository({ db: fixture.db, classRepository: classes }).detail('class-1', 'old-session', 'teacher-1');
  assert.equal(attendance.verificationMode, 'standard');
  assert.equal(attendance.recap[0].checkIn.verificationMethod, 'standard');
  await fixture.db.prepare("DELETE FROM class_members WHERE class_id='class-1' AND user_id='student-1'").run();
  const results = await new QuizRepository({ db: fixture.db, classRepository: classes }).getResult('class-1', 'old-quiz', 'teacher-1');
  assert.equal(results.find((item) => item.id === 'old-attempt-member').studentName, 'Siswa');
  assert.equal(results.find((item) => item.id === 'old-attempt-former').studentName, 'Siswa tidak diketahui');
});
