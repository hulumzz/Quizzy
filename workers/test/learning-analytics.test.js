import assert from 'node:assert/strict';
import test from 'node:test';
import { ClassRepository } from '../src/repositories/class.repository.js';
import { LearningAnalyticsRepository, calculateTrend } from '../src/repositories/learning-analytics.repository.js';
import { createD1Fixture } from './d1-fixture.js';

test('trend distinguishes improvement, decline and insufficient evidence', () => {
  assert.equal(calculateTrend([{ score: 60, occurredAt: '2026-09-01' }]).direction, 'insufficient');
  assert.equal(calculateTrend([{ score: 60, occurredAt: '2026-09-01' }, { score: 72, occurredAt: '2026-09-10' }]).direction, 'improving');
  assert.equal(calculateTrend([{ score: 90, occurredAt: '2026-09-01' }, { score: 76, occurredAt: '2026-09-10' }]).direction, 'declining');
});

test('learning analytics combines assessment, attendance, material, discussion and task evidence', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const { sqlite, db } = fixture;
  const now = '2026-10-01T00:00:00.000Z';
  sqlite.prepare("UPDATE class_members SET joined_at='2026-08-01T00:00:00.000Z' WHERE class_id='class-1' AND user_id='student-1'").run();

  sqlite.prepare("INSERT INTO learning_sessions(id,class_id,owner_id,title,description,meeting_date,status,sort_order,published_at,created_at,updated_at) VALUES('s1','class-1','teacher-1','Aljabar','','2026-09-01','published',1,?1,?1,?1)").run(now);
  sqlite.prepare("INSERT INTO learning_sessions(id,class_id,owner_id,title,description,meeting_date,status,sort_order,published_at,created_at,updated_at) VALUES('s2','class-1','teacher-1','Statistika','','2026-09-15','published',2,?1,?1,?1)").run(now);

  sqlite.prepare("INSERT INTO materials(id,class_id,owner_id,title,summary,status,blocks_json,session_id,published_at,created_at,updated_at) VALUES('m1','class-1','teacher-1','Materi 1','','published','[]','s1',?1,?1,?1)").run(now);
  sqlite.prepare("INSERT INTO materials(id,class_id,owner_id,title,summary,status,blocks_json,session_id,published_at,created_at,updated_at) VALUES('m2','class-1','teacher-1','Materi 2','','published','[]','s2',?1,?1,?1)").run(now);
  sqlite.prepare("INSERT INTO material_progress(class_id,material_id,user_id,percent,status,last_read_at,completed_at,created_at,updated_at) VALUES('class-1','m1','student-1',100,'completed','2026-09-04','2026-09-04','2026-09-04','2026-09-04')").run();
  sqlite.prepare("INSERT INTO material_progress(class_id,material_id,user_id,percent,status,last_read_at,completed_at,created_at,updated_at) VALUES('class-1','m2','student-1',50,'started','2026-09-18',NULL,'2026-09-18','2026-09-18')").run();
  sqlite.prepare("INSERT INTO discussions(id,class_id,material_id,author_id,author_name,author_role,content,status,created_at,updated_at) VALUES('d1','class-1','m1','student-1','Siswa','student','Pertanyaan','open','2026-09-04','2026-09-04')").run();

  sqlite.prepare("INSERT INTO attendance_sessions(id,class_id,owner_id,title,session_id,location_mode,status,ended_at,created_at,updated_at) VALUES('a1','class-1','teacher-1','Presensi 1','s1','online','ended','2026-09-02','2026-09-02','2026-09-02')").run();
  sqlite.prepare("INSERT INTO attendance_sessions(id,class_id,owner_id,title,session_id,location_mode,status,ended_at,created_at,updated_at) VALUES('a2','class-1','teacher-1','Presensi 2','s2','online','ended','2026-09-16','2026-09-16','2026-09-16')").run();
  sqlite.prepare("INSERT INTO attendance_checkins(attendance_id,user_id,class_id,name,checked_in_at) VALUES('a1','student-1','class-1','Siswa','2026-09-02')").run();

  const quizSettings = JSON.stringify({ passingScore: 70 });
  sqlite.prepare("INSERT INTO quizzes(id,class_id,owner_id,session_id,title,description,status,mode,questions_json,settings_json,published_at,created_at,updated_at) VALUES('q1','class-1','teacher-1','s1','Kuis Aljabar','','published','self_paced','[]',?1,'2026-09-01','2026-09-01','2026-09-01')").run(quizSettings);
  sqlite.prepare("INSERT INTO quizzes(id,class_id,owner_id,session_id,title,description,status,mode,questions_json,settings_json,published_at,created_at,updated_at) VALUES('q2','class-1','teacher-1','s2','Kuis Statistika','','published','self_paced','[]',?1,'2026-09-15','2026-09-15','2026-09-15')").run(quizSettings);
  sqlite.prepare("INSERT INTO quiz_attempts(id,quiz_id,class_id,student_id,answers_json,score,earned_points,total_points,passed,submitted_at) VALUES('qa1','q1','class-1','student-1','[]',60,6,10,0,'2026-09-01')").run();
  sqlite.prepare("INSERT INTO quiz_attempts(id,quiz_id,class_id,student_id,answers_json,score,earned_points,total_points,passed,submitted_at) VALUES('qa2','q2','class-1','student-1','[]',80,8,10,1,'2026-09-20')").run();

  sqlite.prepare("INSERT INTO tasks(id,class_id,owner_id,session_id,title,instructions,due_at,response_mode,status,published_at,created_at,updated_at) VALUES('t1','class-1','teacher-1','s1','Tugas Aljabar','','2026-09-06','text','published','2026-09-01','2026-09-01','2026-09-01')").run();
  sqlite.prepare("INSERT INTO tasks(id,class_id,owner_id,session_id,title,instructions,due_at,response_mode,status,published_at,created_at,updated_at) VALUES('t2','class-1','teacher-1','s2','Tugas Statistika','','2026-09-22','text','published','2026-09-15','2026-09-15','2026-09-15')").run();
  sqlite.prepare("INSERT INTO task_submissions(task_id,student_id,class_id,student_name,text_answer,attachments_json,status,late,submitted_at,attempt_number,revision_count,score,feedback,graded_at,updated_at) VALUES('t1','student-1','class-1','Siswa','','[]','graded',0,'2026-09-05',1,0,70,'','2026-09-05','2026-09-05')").run();
  sqlite.prepare("INSERT INTO task_submissions(task_id,student_id,class_id,student_name,text_answer,attachments_json,status,late,submitted_at,attempt_number,revision_count,score,feedback,graded_at,updated_at) VALUES('t2','student-1','class-1','Siswa','','[]','graded',1,'2026-09-25',1,0,90,'','2026-09-25','2026-09-25')").run();

  const repository = new LearningAnalyticsRepository({ db, classRepository: new ClassRepository(db) });
  const own = await repository.getStudent('class-1', 'student-1', 'student-1', { now: new Date(now) });
  assert.equal(own.profile.mastery, 75.3);
  assert.equal(own.profile.consistency, 65);
  assert.equal(own.profile.engagement, 71.3);
  assert.equal(own.profile.trend.direction, 'improving');
  assert.equal(own.profile.trend.delta, 20);
  assert.equal(own.profile.confidence.label, 'tinggi');
  assert.equal(own.profile.status.key, 'developing');
  assert.equal(own.profile.strongestSession.title, 'Statistika');
  assert.equal(own.profile.weakestSession.title, 'Aljabar');

  const overview = await repository.getClassOverview('class-1', 'teacher-1', { now: new Date(now) });
  assert.equal(overview.students.length, 1);
  assert.equal(overview.statuses.developing, 1);
  assert.equal(overview.summary.mastery, 75.3);
  assert.equal(overview.sessionAnalytics.length, 2);
  assert.equal(overview.unmapped.materials, 0);
  assert.ok(overview.insights.some((item) => item.title.includes('meningkat')));

  await assert.rejects(() => repository.getClassOverview('class-1', 'student-1'), { code: 'FORBIDDEN' });
  await assert.rejects(() => repository.getStudent('class-1', 'student-1', 'another-student'), { code: 'FORBIDDEN' });
});

test('analytics keeps mastery empty when only engagement evidence exists', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const { sqlite, db } = fixture;
  sqlite.prepare("UPDATE class_members SET joined_at='2026-08-01T00:00:00.000Z' WHERE class_id='class-1' AND user_id='student-1'").run();
  sqlite.prepare("INSERT INTO materials(id,class_id,owner_id,title,summary,status,blocks_json,published_at,created_at,updated_at) VALUES('m1','class-1','teacher-1','Materi','','published','[]','2026-09-01','2026-09-01','2026-09-01')").run();
  sqlite.prepare("INSERT INTO material_progress(class_id,material_id,user_id,percent,status,last_read_at,completed_at,created_at,updated_at) VALUES('class-1','m1','student-1',100,'completed','2026-09-02','2026-09-02','2026-09-02','2026-09-02')").run();
  const repository = new LearningAnalyticsRepository({ db, classRepository: new ClassRepository(db) });
  const own = await repository.getStudent('class-1', 'student-1', 'student-1', { now: new Date('2026-10-01T00:00:00.000Z') });
  assert.equal(own.profile.mastery, null);
  assert.equal(own.profile.status.key, 'insufficient');
  assert.equal(own.profile.counts.materialsCompleted, 1);
});


test('analytics ignores attendance and overdue tasks from before membership started', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const { sqlite, db } = fixture;
  sqlite.prepare("UPDATE class_members SET joined_at='2026-09-30T00:00:00.000Z' WHERE class_id='class-1' AND user_id='student-1'").run();
  sqlite.prepare("INSERT INTO attendance_sessions(id,class_id,owner_id,title,location_mode,status,ended_at,created_at,updated_at) VALUES('old-a','class-1','teacher-1','Presensi lama','online','ended','2026-09-10','2026-09-10','2026-09-10')").run();
  sqlite.prepare("INSERT INTO tasks(id,class_id,owner_id,title,instructions,due_at,response_mode,status,published_at,created_at,updated_at) VALUES('old-t','class-1','teacher-1','Tugas lama','','2026-09-15','text','published','2026-09-01','2026-09-01','2026-09-01')").run();
  const repository = new LearningAnalyticsRepository({ db, classRepository: new ClassRepository(db) });
  const own = await repository.getStudent('class-1', 'student-1', 'student-1', { now: new Date('2026-10-01T00:00:00.000Z') });
  assert.equal(own.profile.counts.attendanceExpected, 0);
  assert.equal(own.profile.counts.tasksEligible, 0);
  assert.equal(own.profile.consistency, null);
});

test('ungraded task supports consistency but never becomes zero mastery', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const { sqlite, db } = fixture;
  sqlite.prepare("UPDATE class_members SET joined_at='2026-08-01T00:00:00.000Z' WHERE class_id='class-1' AND user_id='student-1'").run();
  sqlite.prepare("INSERT INTO tasks(id,class_id,owner_id,title,instructions,due_at,response_mode,status,published_at,created_at,updated_at) VALUES('t1','class-1','teacher-1','Tugas','','2026-09-15','text','published','2026-09-01','2026-09-01','2026-09-01')").run();
  sqlite.prepare("INSERT INTO task_submissions(task_id,student_id,class_id,student_name,text_answer,attachments_json,status,late,submitted_at,attempt_number,revision_count,score,feedback,updated_at) VALUES('t1','student-1','class-1','Siswa','Jawaban','[]','submitted',0,'2026-09-10',1,0,NULL,'','2026-09-10')").run();
  const repository = new LearningAnalyticsRepository({ db, classRepository: new ClassRepository(db) });
  const own = await repository.getStudent('class-1', 'student-1', 'student-1', { now: new Date('2026-10-01T00:00:00.000Z') });
  assert.equal(own.profile.mastery, null);
  assert.equal(own.profile.counts.tasksGraded, 0);
  assert.equal(own.profile.rates.taskCompletion, 100);
});

test('analytics measures score gain after revision without inflating mastery history', async (t) => {
  const fixture = createD1Fixture(); t.after(fixture.close);
  const { sqlite, db } = fixture;
  sqlite.prepare("UPDATE class_members SET joined_at='2026-08-01T00:00:00.000Z' WHERE class_id='class-1' AND user_id='student-1'").run();
  sqlite.prepare("INSERT INTO tasks(id,class_id,owner_id,title,instructions,due_at,response_mode,status,published_at,created_at,updated_at) VALUES('t1','class-1','teacher-1','Tugas Revisi','','2026-09-20','text','published','2026-09-01','2026-09-01','2026-09-01')").run();
  sqlite.prepare("INSERT INTO task_submissions(task_id,student_id,class_id,student_name,text_answer,attachments_json,status,late,submitted_at,attempt_number,revision_count,score,feedback,graded_at,updated_at) VALUES('t1','student-1','class-1','Siswa','Jawaban revisi','[]','graded',0,'2026-09-18',2,1,85,'Bagus','2026-09-19','2026-09-19')").run();
  sqlite.prepare("INSERT INTO task_submission_revisions(id,task_id,student_id,previous_json,created_at) VALUES('r1','t1','student-1',?1,'2026-09-17')").run(JSON.stringify({ status: 'graded', score: 65, feedback: 'Perbaiki', textAnswer: 'Jawaban lama', attachments: [], submittedAt: '2026-09-10', attemptNumber: 1 }));
  const repository = new LearningAnalyticsRepository({ db, classRepository: new ClassRepository(db) });
  const own = await repository.getStudent('class-1', 'student-1', 'student-1', { now: new Date('2026-10-01T00:00:00.000Z') });
  assert.equal(own.profile.mastery, 85);
  assert.equal(own.profile.revisionResponse.averageGain, 20);
  assert.equal(own.profile.revisionResponse.improvedCount, 1);
});
