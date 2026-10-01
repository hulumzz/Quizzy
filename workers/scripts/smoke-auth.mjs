import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { closeSmokeSockets } from './smoke-live-sockets.mjs';

const workerDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(workerDir, '..');
const envText = readFileSync(path.join(rootDir, '.env'), 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => /^[A-Za-z_][A-Za-z_0-9]*=/.test(line)).map((line) => {
  const position = line.indexOf('=');
  return [line.slice(0, position), line.slice(position + 1).trim()];
}));
const apiKey = env.VITE_FIREBASE_API_KEY;
assert.ok(apiKey && env.VITE_FIREBASE_PROJECT_ID === 'quizzy-eb33b', 'Firebase project configuration is missing or does not match the Worker');
const workerUrl = process.env.NALARO_SMOKE_API_URL || 'https://nalaro-api.uniquefactuhl.workers.dev';
const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts`;
const created = [];
let teacher;
let student;

async function authRequest(action, payload) {
  const response = await fetch(`${authUrl}:${action}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Firebase ${action}: ${result.error?.message || response.status}`);
  return result;
}
async function signup() {
  const password = `${randomUUID().replace(/-/g, '').slice(0, 12)}A1!`;
  const account = await authRequest('signUp', {
    email: `migration-smoke-${randomUUID()}@example.com`,
    password,
    returnSecureToken: true,
  });
  account.smokePassword = password;
  created.push(account);
  const login = await authRequest('signInWithPassword', { email: account.email, password, returnSecureToken: true });
  account.idToken = login.idToken;
  return account;
}
async function createProfile(account, role) {
  const now = new Date().toISOString();
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.VITE_FIREBASE_PROJECT_ID)}/databases/(default)/documents/users/${encodeURIComponent(account.localId)}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${account.idToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: {
      uid: { stringValue: account.localId },
      name: { stringValue: role === 'teacher' ? 'Guru Smoke' : 'Siswa Smoke' },
      nickname: { stringValue: role === 'teacher' ? 'Guru' : 'Siswa' },
      email: { stringValue: account.email || '' },
      role: { stringValue: role },
      subject: { stringValue: role === 'teacher' ? 'Matematika' : 'Kelas Uji' },
      institution: { stringValue: 'Nalaro Smoke Test' },
      gender: { stringValue: 'prefer_not_to_say' },
      avatar: { nullValue: null },
      isAnonymous: { booleanValue: false },
      profileCompleted: { booleanValue: true },
      createdAt: { stringValue: now },
      updatedAt: { stringValue: now },
    } }),
  });
  if (!response.ok) throw new Error(`Firestore profile ${role}: HTTP ${response.status}`);
}
async function deleteProfile(account) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.VITE_FIREBASE_PROJECT_ID)}/databases/(default)/documents/users/${encodeURIComponent(account.localId)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${account.idToken}` },
  });
  if (!response.ok && response.status !== 404) throw new Error(`Firestore profile cleanup: HTTP ${response.status}`);
}
async function call(label, method, route, token, body) {
  const response = await fetch(`${workerUrl}${route}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status} ${payload.error?.code || 'UNKNOWN'}`);
  console.log(`${label}: HTTP ${response.status}`);
  return payload.data;
}
function cleanupDatabase() {
  if (!teacher) return;
  const ids = [teacher.localId, student?.localId].filter(Boolean);
  assert.ok(ids.every((id) => /^[A-Za-z0-9_-]+$/.test(id)));
  const teacherId = teacher.localId;
  const statements = [
    `DELETE FROM live_quiz_sessions WHERE owner_id='${teacherId}'`,
    `DELETE FROM quiz_bank_catalog WHERE author_id='${teacherId}'`,
    `DELETE FROM general_quizzes WHERE owner_id='${teacherId}'`,
    `DELETE FROM classes WHERE owner_id='${teacherId}'`,
    `DELETE FROM users WHERE id IN (${ids.map((id) => `'${id}'`).join(',')})`,
  ];
  const bin = path.join(workerDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  for (const statement of statements) {
    const result = spawnSync(process.execPath, [bin, 'd1', 'execute', 'nalaro', '--remote', '--command', statement, '--config', 'wrangler.json'], {
      cwd: workerDir, encoding: 'utf8', timeout: 30_000,
    });
    if (result.status !== 0) throw new Error(`D1 cleanup failed: ${result.status ?? result.error?.code}`);
  }
  console.log('D1 cleanup: complete');
}

async function expectDenied(label, method, route, token, body, expected = 403) {
  const response = await fetch(`${workerUrl}${route}`, { method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.equal(response.status, expected, `${label}: expected HTTP ${expected}, received ${response.status}`);
  console.log(`${label}: denied HTTP ${expected}`);
}

async function securitySmoke({ classroom, quiz, task, teacherToken, studentToken }) {
  const base = `/classes/${classroom.id}`;
  await expectDenied('student create class', 'POST', '/classes', studentToken, { name: 'Forbidden' });
  await expectDenied('student create quiz', 'POST', `${base}/quizzes`, studentToken, {});
  await expectDenied('student edit quiz', 'PUT', `${base}/quizzes/${quiz.id}`, studentToken, {});
  await expectDenied('student grade task', 'PUT', `${base}/tasks/${task.id}/submissions/${student.localId}`, studentToken, { status: 'graded', score: 100, feedback: '' });
  await expectDenied('student host Live', 'POST', `${base}/quizzes/${quiz.id}/live-sessions`, studentToken, {});
  await expectDenied('student class analytics', 'GET', `${base}/analytics`, studentToken);
  await expectDenied('student other analytics', 'GET', `${base}/analytics/students/${teacher.localId}`, studentToken);
  await expectDenied('teacher student-only submission', 'POST', `${base}/tasks/${task.id}/submission`, teacherToken, { textAnswer: 'Forbidden', attachments: [] });
  await expectDenied('duplicate quiz attempt', 'POST', `${base}/quizzes/${quiz.id}/attempts`, studentToken, { answers: [{ questionId: 'q1', answer: 'Four' }] }, 409);
}

async function csvSmoke(route, token) {
  const response = await fetch(`${workerUrl}${route}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('Peringkat,Nama,Student ID'));
  console.log('Persistent Live CSV export: PASS');
}

let failed = false;
try {
  teacher = await signup();
  student = await signup();
  await createProfile(teacher, 'teacher');
  await createProfile(student, 'student');
  console.log('Firebase test accounts and immutable role profiles: created');
  const teacherToken = teacher.idToken;
  const studentToken = student.idToken;
  const classroom = (await call('class create', 'POST', '/classes', teacherToken, { name: 'Migration smoke test' })).class;
  assert.ok(classroom.id && classroom.code);
  await call('class join', 'POST', '/classes/join', studentToken, { code: classroom.code });
  assert.equal((await call('class member list', 'GET', `/classes/${classroom.id}/members`, teacherToken)).members.length, 1);
  const learning = (await call('learning session create', 'POST', `/classes/${classroom.id}/sessions`, teacherToken, { title: 'Pertemuan smoke', meetingDate: new Date().toISOString().slice(0, 10), status: 'published' })).session;
  const material = (await call('material create', 'POST', `/classes/${classroom.id}/materials`, teacherToken, { title: 'Materi smoke', status: 'published', sessionId: learning.id, blocks: [{ id: 'p1', type: 'paragraph', content: 'Materi pecahan untuk pengujian release.' }] })).material;
  await call('material read', 'GET', `/classes/${classroom.id}/materials/${material.id}`, studentToken);
  await call('material progress', 'PUT', `/classes/${classroom.id}/materials/${material.id}/progress`, studentToken, { percent: 100 });
  await call('discussion create', 'POST', `/classes/${classroom.id}/materials/${material.id}/discussions`, studentToken, { content: 'Pertanyaan pengujian release.' });
  const attendance = (await call('attendance create', 'POST', `/classes/${classroom.id}/attendance`, teacherToken, { title: 'Presensi smoke', locationMode: 'online', sessionId: learning.id })).attendance;
  await call('attendance activate', 'PUT', `/classes/${classroom.id}/attendance/${attendance.id}/status`, teacherToken, { status: 'active' });
  await call('attendance check-in', 'POST', `/classes/${classroom.id}/attendance/${attendance.id}/check-in`, studentToken, {});
  await call('attendance end', 'PUT', `/classes/${classroom.id}/attendance/${attendance.id}/status`, teacherToken, { status: 'ended' });
  await call('material upload signature', 'POST', `/classes/${classroom.id}/uploads/signature`, teacherToken, { fileName: 'smoke.png', mimeType: 'image/png', size: 10 });

  const quiz = (await call('quiz create', 'POST', `/classes/${classroom.id}/quizzes`, teacherToken, {
    title: 'Migration quiz', status: 'published', sessionId: learning.id, questions: [{ id: 'q1', type: 'multiple_choice', prompt: 'Two plus two?', choices: ['Four', 'Five'], correctAnswer: 'Four', points: 1 }],
  })).quiz;
  assert.ok(quiz.id);
  const quizResult = (await call('quiz submit', 'POST', `/classes/${classroom.id}/quizzes/${quiz.id}/attempts`, studentToken, { answers: [{ questionId: 'q1', answer: 'Four' }] })).result;
  assert.equal(quizResult.score, 100);
  await call('quiz export', 'GET', `/classes/${classroom.id}/quizzes/${quiz.id}/export`, teacherToken);

  const task = (await call('task create', 'POST', `/classes/${classroom.id}/tasks`, teacherToken, {
    title: 'Migration task', sessionId: learning.id, dueAt: new Date(Date.now() + 86400_000).toISOString(), responseMode: 'text', status: 'published',
  })).task;
  await call('task submit', 'POST', `/classes/${classroom.id}/tasks/${task.id}/submission`, studentToken, { textAnswer: 'Done', attachments: [] });
  await call('task grade', 'PUT', `/classes/${classroom.id}/tasks/${task.id}/submissions/${student.localId}`, teacherToken, { status: 'graded', score: 90, feedback: 'Good' });
  const uploadTask = (await call('attachment task create', 'POST', `/classes/${classroom.id}/tasks`, teacherToken, {
    title: 'Migration attachment task', dueAt: new Date(Date.now() + 86400_000).toISOString(), responseMode: 'attachment', status: 'published',
  })).task;
  await call('task upload signature', 'POST', `/classes/${classroom.id}/tasks/${uploadTask.id}/uploads/signature`, studentToken, { fileName: 'smoke.png', mimeType: 'image/png', size: 10 });

  const catalog = (await call('quiz bank publish', 'POST', '/quiz-bank/publish', teacherToken, {
    classId: classroom.id, quizId: quiz.id, level: 'sd', subjectId: 'matematika', tags: [], license: 'atribusi',
  })).quiz;
  await call('quiz bank copy', 'POST', `/quiz-bank/${catalog.id}/copy`, teacherToken, { classId: classroom.id });
  const general = (await call('general quiz create', 'POST', '/general-quizzes', teacherToken, {
    title: 'Migration general quiz', status: 'published', questions: [{ id: 'g1', type: 'true_false', prompt: 'Is this a test?', correctAnswer: true, points: 1 }],
  })).quiz;
  assert.equal((await call('general quiz read', 'GET', `/general-quizzes/${general.id}`, teacherToken)).quiz.id, general.id);

  await securitySmoke({ classroom, quiz, task, teacherToken, studentToken });
  const live = (await call('live create', 'POST', `/classes/${classroom.id}/quizzes/${quiz.id}/live-sessions`, teacherToken, { questionDurationSeconds: 30 })).session;
  const joined = await call('live join', 'POST', `/live-quizzes/${live.code}/join`, studentToken, { name: 'Smoke Student' });
  const publicParticipants = [];
  for (let index = 0; index < 3; index += 1) publicParticipants.push((await call('public live join', 'POST', `/live-quizzes/${live.code}/join`, null, { name: `Pemain Uji ${index + 1}` })).participant);
  const { testLiveSockets } = await import('./smoke-live-sockets.mjs');
  const sockets = await testLiveSockets({ workerUrl, call, classroom, live, teacherToken, participants: [joined.participant, ...publicParticipants] });
  const current = (await call('live advance', 'POST', `/classes/${classroom.id}/live-sessions/${live.id}/action`, teacherToken, { action: 'advance' })).session;
  assert.equal(current.question.correctAnswer, undefined);
  await call('live answer', 'POST', `/live-quizzes/${live.code}/answer`, null, { participantId: joined.participant.id, participantToken: joined.participant.participantToken, questionId: 'q1', answer: 'Four' });
  await sockets.expectPhase('question');
  const privateState = await call('participant state recovery', 'POST', `/live-quizzes/${live.code}/state`, null, joined.participant);
  assert.equal(privateState.session.receipt.accepted, true);
  assert.equal(privateState.session.receipt.correct, undefined);
  await expectDenied('duplicate Live answer', 'POST', `/live-quizzes/${live.code}/answer`, null, { ...joined.participant, questionId: 'q1', answer: 'Five' }, 409);
  const previousParticipant = { ...joined.participant };
  const rejoined = await call('authenticated Live rejoin', 'POST', `/live-quizzes/${live.code}/join`, studentToken, { name: 'Smoke Student Reconnected' });
  assert.equal(rejoined.participant.id, previousParticipant.id);
  assert.notEqual(rejoined.participant.participantToken, previousParticipant.participantToken);
  await expectDenied('invalidated participant token', 'POST', `/live-quizzes/${live.code}/state`, null, previousParticipant, 403);
  Object.assign(joined.participant, rejoined.participant);
  await sockets.reconnect();
  await call('live reveal', 'POST', `/classes/${classroom.id}/live-sessions/${live.id}/action`, teacherToken, { action: 'advance' });
  await sockets.expectPhase('reveal');
  await call('live finish', 'POST', `/classes/${classroom.id}/live-sessions/${live.id}/action`, teacherToken, { action: 'finish' });
  await sockets.expectPhase('finished');
  sockets.close();
  const result = (await call('live result', 'POST', `/live-quizzes/${live.code}/result`, null, { participantId: joined.participant.id, participantToken: joined.participant.participantToken })).result;
  assert.equal(result.participant.score, 1);
  assert.equal(result.participant.studentId, student.localId);
  const persisted = await call('live persisted report', 'GET', `/classes/${classroom.id}/live-results/${live.id}`, teacherToken);
  assert.equal(persisted.result.participants.find(p => p.studentId === student.localId).score, 1);
  assert.equal(persisted.result.participants.filter(p => p.studentId === null).length, 3);
  await csvSmoke(`/classes/${classroom.id}/live-results/${live.id}/export`, teacherToken);
  const analytics = await call('Learning Insights with Live', 'GET', `/classes/${classroom.id}/analytics/students/${student.localId}`, teacherToken);
  assert.equal(analytics.analytics.profile.counts.liveQuizzesCompleted, 1);
  await call('own Learning Insights', 'GET', `/classes/${classroom.id}/analytics/me`, studentToken);
  if (process.env.NALARO_SMOKE_BROWSER === '1') {
    const { runBrowserSmoke } = await import('./smoke-browser.mjs');
    await runBrowserSmoke({ teacher, student, classroom, quiz, task, material, workerUrl, call, teacherToken });
  }
  await call('AI draft', 'POST', '/api/ai/assist', teacherToken, { task: 'material_draft', context: 'Pecahan sederhana: satu per dua adalah setengah dari satu keseluruhan.', instruction: 'Buat ringkasan singkat.' });
  console.log('Authenticated Worker smoke test: passed');
} catch (error) {
  failed = true;
  console.error(error.message);
} finally {
  closeSmokeSockets();
  try { cleanupDatabase(); } catch (error) { failed = true; console.error(error.message); }
  for (const account of created) {
    try { await deleteProfile(account); }
    catch (error) { failed = true; console.error(`Firestore cleanup: ${error.message}`); }
    try { await authRequest('delete', { idToken: account.idToken }); }
    catch (error) { failed = true; console.error(`Firebase cleanup: ${error.message}`); }
  }
  if (created.length) console.log('Firebase test accounts: cleanup attempted');
}
if (failed) process.exitCode = 1;
