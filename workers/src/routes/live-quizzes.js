import { badRequest, forbidden, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { liveCode } from '../durable/LiveQuizRoom.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { GeneralQuizRepository } from '../repositories/general-quiz.repository.js';
import { QuizRepository } from '../repositories/quiz.repository.js';
import { validateClassId } from '../validation/classes.js';
import { validateQuizId } from '../validation/quizzes.js';
import { validateLiveAction, validateLiveAnswer, validateLiveCode, validateLiveJoin, validateLiveParticipantSession, validateLiveSessionInput } from '../validation/live-quiz.js';

async function body(c, optional = false) {
  if (Number(c.req.header('content-length') || 0) > 8192) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data sesi terlalu besar.');
  const raw = await c.req.text();
  if (!raw && optional) return {};
  if (!raw) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (raw.length > 8192) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data sesi terlalu besar.');
  try { return JSON.parse(raw); } catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); }
}
async function room(c, code, path, input = {}) {
  if (!c.env.LIVE_QUIZ) throw new HttpError(503, 'LIVE_NOT_CONFIGURED', 'Layanan kuis live belum dikonfigurasi.');
  const stub = c.env.LIVE_QUIZ.getByName(code);
  const response = await stub.fetch(new Request(`https://room.internal/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }));
  const payload = await response.json();
  if (!response.ok) throw new HttpError(response.status, payload.error?.code || 'LIVE_UNAVAILABLE', payload.error?.message || 'Sesi kuis belum dapat diproses.');
  return payload.data;
}
function host(c) { const auth = getAuth(c); if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menjadi host kuis.'); return auth.uid; }
async function ipHash(c) {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function create(c, scope) {
  const ownerId = host(c);
  const quizId = validateQuizId(c.req.param('quizId'));
  const duration = validateLiveSessionInput(await body(c, true));
  let source;
  let classId = null;
  if (scope === 'class') {
    classId = validateClassId(c.req.param('classId'));
    const classes = new ClassRepository(c.env.DB);
    const quizzes = new QuizRepository({ db: c.env.DB, classRepository: classes });
    await quizzes.owner(classId, ownerId);
    source = await quizzes.item(classId, quizId);
  } else source = await new GeneralQuizRepository(c.env.DB).item(ownerId, quizId);
  if (source.status !== 'published') throw new HttpError(409, 'QUIZ_NOT_PUBLISHED', 'Terbitkan kuis sebelum memulai sesi live.');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = liveCode();
    try {
      return await room(c, code, 'initialize', { code, scope, classId, quizId, ownerId, title: source.title, questions: JSON.parse(source.questions_json), ...duration });
    } catch (error) { if (error.code !== 'LIVE_CODE_CONFLICT') throw error; }
  }
  throw new HttpError(409, 'LIVE_CODE_CONFLICT', 'Kode kuis belum dapat dibuat. Silakan coba lagi.');
}
export function registerLiveQuizRoutes(app) {
  app.post('/classes/:classId/quizzes/:quizId/live-sessions', requireAuth, async (c) => json(c, 201, { data: { session: await create(c, 'class') } }));
  app.post('/general-quizzes/:quizId/live-sessions', requireAuth, async (c) => json(c, 201, { data: { session: await create(c, 'general') } }));
  app.get('/classes/:classId/live-sessions/:sessionId', requireAuth, async (c) => json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('sessionId')), 'host', { ownerId: host(c), scope: 'class', classId: validateClassId(c.req.param('classId')) }) } }));
  app.post('/classes/:classId/live-sessions/:sessionId/action', requireAuth, async (c) => json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('sessionId')), 'advance', { ownerId: host(c), scope: 'class', classId: validateClassId(c.req.param('classId')), ...validateLiveAction(await body(c)) }) } }));
  app.get('/general-quizzes/live-sessions/:sessionId', requireAuth, async (c) => json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('sessionId')), 'host', { ownerId: host(c), scope: 'general' }) } }));
  app.post('/general-quizzes/live-sessions/:sessionId/action', requireAuth, async (c) => json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('sessionId')), 'advance', { ownerId: host(c), scope: 'general', ...validateLiveAction(await body(c)) }) } }));
  app.get('/live-quizzes/:code', async (c) => json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('code')), 'public') } }));
  app.post('/live-quizzes/:code/join', async (c) => json(c, 201, { data: await room(c, validateLiveCode(c.req.param('code')), 'join', { ...validateLiveJoin(await body(c)), ipHash: await ipHash(c) }) }));
  app.post('/live-quizzes/:code/answer', async (c) => json(c, 202, { data: { receipt: await room(c, validateLiveCode(c.req.param('code')), 'answer', validateLiveAnswer(await body(c))) } }));
  app.post('/live-quizzes/:code/result', async (c) => json(c, 200, { data: { result: await room(c, validateLiveCode(c.req.param('code')), 'result', validateLiveParticipantSession(await body(c))) } }));
}
