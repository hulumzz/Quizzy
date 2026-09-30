import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workerDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(workerDir, '..');
const envText = readFileSync(path.join(rootDir, '.env'), 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => /^[A-Za-z_][A-Za-z_0-9]*=/.test(line)).map((line) => {
  const position = line.indexOf('=');
  return [line.slice(0, position), line.slice(position + 1).trim()];
}));
const apiKey = env.VITE_FIREBASE_API_KEY;
assert.ok(apiKey && env.VITE_FIREBASE_PROJECT_ID === 'quizzy-eb33b', 'Firebase project configuration is missing or does not match the Worker');
const workerUrl = 'https://nalaro-api.uniquefactuhl.workers.dev';
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
  const account = await authRequest('signUp', {
    email: `migration-smoke-${randomUUID()}@example.com`,
    password: `${randomUUID().replace(/-/g, '').slice(0, 12)}A1!`,
    returnSecureToken: true,
  });
  created.push(account);
  return account;
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

let failed = false;
try {
  teacher = await signup();
  student = await signup();
  console.log('Firebase test accounts: created');
  const teacherToken = teacher.idToken;
  const studentToken = student.idToken;
  const classroom = (await call('class create', 'POST', '/classes', teacherToken, { name: 'Migration smoke test' })).class;
  assert.ok(classroom.id && classroom.code);
  await call('class join', 'POST', '/classes/join', studentToken, { code: classroom.code });
  assert.equal((await call('class member list', 'GET', `/classes/${classroom.id}/members`, teacherToken)).members.length, 1);
  await call('material upload signature', 'POST', `/classes/${classroom.id}/uploads/signature`, teacherToken, { fileName: 'smoke.png', mimeType: 'image/png', size: 10 });

  const quiz = (await call('quiz create', 'POST', `/classes/${classroom.id}/quizzes`, teacherToken, {
    title: 'Migration quiz', status: 'published', questions: [{ id: 'q1', type: 'multiple_choice', prompt: 'Two plus two?', choices: ['Four', 'Five'], correctAnswer: 'Four', points: 1 }],
  })).quiz;
  assert.ok(quiz.id);
  const quizResult = (await call('quiz submit', 'POST', `/classes/${classroom.id}/quizzes/${quiz.id}/attempts`, studentToken, { answers: [{ questionId: 'q1', answer: 'Four' }] })).result;
  assert.equal(quizResult.score, 100);
  await call('quiz export', 'GET', `/classes/${classroom.id}/quizzes/${quiz.id}/export`, teacherToken);

  const task = (await call('task create', 'POST', `/classes/${classroom.id}/tasks`, teacherToken, {
    title: 'Migration task', dueAt: '2026-10-10T00:00:00.000Z', responseMode: 'text', status: 'published',
  })).task;
  await call('task submit', 'POST', `/classes/${classroom.id}/tasks/${task.id}/submission`, studentToken, { textAnswer: 'Done', attachments: [] });
  await call('task grade', 'PUT', `/classes/${classroom.id}/tasks/${task.id}/submissions/${student.localId}`, teacherToken, { status: 'graded', score: 90, feedback: 'Good' });
  const uploadTask = (await call('attachment task create', 'POST', `/classes/${classroom.id}/tasks`, teacherToken, {
    title: 'Migration attachment task', dueAt: '2026-10-10T00:00:00.000Z', responseMode: 'attachment', status: 'published',
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

  const live = (await call('live create', 'POST', `/classes/${classroom.id}/quizzes/${quiz.id}/live-sessions`, teacherToken, { questionDurationSeconds: 30 })).session;
  const joined = await call('live join', 'POST', `/live-quizzes/${live.code}/join`, null, { name: 'Smoke Student' });
  const current = (await call('live advance', 'POST', `/classes/${classroom.id}/live-sessions/${live.id}/action`, teacherToken, { action: 'advance' })).session;
  assert.equal(current.question.correctAnswer, undefined);
  await call('live answer', 'POST', `/live-quizzes/${live.code}/answer`, null, { participantId: joined.participant.id, participantToken: joined.participant.participantToken, questionId: 'q1', answer: 'Four' });
  await call('live reveal', 'POST', `/classes/${classroom.id}/live-sessions/${live.id}/action`, teacherToken, { action: 'advance' });
  await call('live finish', 'POST', `/classes/${classroom.id}/live-sessions/${live.id}/action`, teacherToken, { action: 'finish' });
  const result = (await call('live result', 'POST', `/live-quizzes/${live.code}/result`, null, { participantId: joined.participant.id, participantToken: joined.participant.participantToken })).result;
  assert.equal(result.participant.score, 1);
  await call('AI draft', 'POST', '/api/ai/assist', teacherToken, { task: 'material_draft', context: 'Pecahan sederhana: satu per dua adalah setengah dari satu keseluruhan.', instruction: 'Buat ringkasan singkat.' });
  console.log('Authenticated Worker smoke test: passed');
} catch (error) {
  failed = true;
  console.error(error.message);
} finally {
  try { cleanupDatabase(); } catch (error) { failed = true; console.error(error.message); }
  for (const account of created) {
    try { await authRequest('delete', { idToken: account.idToken }); }
    catch (error) { failed = true; console.error(`Firebase cleanup: ${error.message}`); }
  }
  if (created.length) console.log('Firebase test accounts: cleanup attempted');
}
if (failed) process.exitCode = 1;
