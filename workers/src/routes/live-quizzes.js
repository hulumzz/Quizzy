import { badRequest, forbidden, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { liveCode } from '../durable/LiveQuizRoom.js';
import { assertAccountRole, getAccountRole, getAuth, optionalAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { GeneralQuizRepository } from '../repositories/general-quiz.repository.js';
import { LiveResultRepository, liveResultCsv } from '../repositories/live-result.repository.js';
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

function liveStub(c, code) {
  if (!c.env.LIVE_QUIZ) throw new HttpError(503, 'LIVE_NOT_CONFIGURED', 'Layanan kuis live belum dikonfigurasi.');
  return c.env.LIVE_QUIZ.getByName(code);
}

async function room(c, code, path, input = {}) {
  const response = await liveStub(c, code).fetch(new Request(`https://room.internal/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }));
  const payload = await response.json();
  if (!response.ok) throw new HttpError(response.status, payload.error?.code || 'LIVE_UNAVAILABLE', payload.error?.message || 'Sesi kuis belum dapat diproses.');
  return payload.data;
}

async function roomSocket(c, code) {
  const response = await liveStub(c, code).fetch(new Request('https://room.internal/socket', {
    method: 'GET',
    headers: c.req.raw.headers,
  }));
  return response;
}

async function host(c) {
  const auth = getAuth(c);
  if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menjadi host kuis.');
  await assertAccountRole(c, 'teacher');
  return auth.uid;
}

async function ipHash(c) {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function results(c) {
  const classes = new ClassRepository(c.env.DB);
  return new LiveResultRepository({ db: c.env.DB, classRepository: classes });
}

async function create(c, scope) {
  const ownerId = await host(c);
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
    if (await c.env.DB.prepare('SELECT id FROM live_quiz_sessions WHERE id=?1').bind(code).first()) continue;
    try {
      return await room(c, code, 'initialize', {
        code,
        scope,
        classId,
        learningSessionId: scope === 'class' ? source.session_id || null : null,
        quizId,
        ownerId,
        title: source.title,
        questions: JSON.parse(source.questions_json),
        ...duration,
      });
    } catch (error) {
      if (error.code !== 'LIVE_CODE_CONFLICT') throw error;
    }
  }
  throw new HttpError(409, 'LIVE_CODE_CONFLICT', 'Kode kuis belum dapat dibuat. Silakan coba lagi.');
}

async function optionalStudentIdentity(c, code) {
  const identity = getAuth(c);
  if (!identity || identity.signInProvider === 'anonymous') return null;
  let role;
  try { role = await getAccountRole(c); } catch { return null; }
  if (role !== 'student') return null;
  const context = await room(c, code, 'context');
  if (context.scope !== 'class' || !context.classId) return null;
  try {
    const access = await new ClassRepository(c.env.DB).getForUser(context.classId, identity.uid);
    return access.accessRole === 'member' ? identity.uid : null;
  } catch {
    return null;
  }
}

function csvResponse(result) {
  const name = String(result.title || 'nalaro-live').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80) || 'nalaro-live';
  return new Response('\uFEFF' + liveResultCsv(result), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}-hasil-live.csv"`,
      'cache-control': 'private, no-store',
    },
  });
}

export function registerLiveQuizRoutes(app) {
  app.post('/classes/:classId/quizzes/:quizId/live-sessions', requireAuth, async (c) => json(c, 201, { data: { session: await create(c, 'class') } }));
  app.post('/general-quizzes/:quizId/live-sessions', requireAuth, async (c) => json(c, 201, { data: { session: await create(c, 'general') } }));

  app.get('/classes/:classId/live-sessions/:sessionId', requireAuth, async (c) => {
    const ownerId = await host(c);
    return json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('sessionId')), 'host', { ownerId, scope: 'class', classId: validateClassId(c.req.param('classId')) }) } });
  });
  app.post('/classes/:classId/live-sessions/:sessionId/action', requireAuth, async (c) => {
    const ownerId = await host(c);
    return json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('sessionId')), 'advance', { ownerId, scope: 'class', classId: validateClassId(c.req.param('classId')), ...validateLiveAction(await body(c)) }) } });
  });
  app.post('/classes/:classId/live-sessions/:sessionId/socket-ticket', requireAuth, async (c) => {
    const ownerId = await host(c);
    return json(c, 200, { data: { socket: await room(c, validateLiveCode(c.req.param('sessionId')), 'socket-ticket', { ownerId, scope: 'class', classId: validateClassId(c.req.param('classId')) }) } });
  });
  app.post('/classes/:classId/live-sessions/:sessionId/persist', requireAuth, async (c) => {
    const ownerId = await host(c);
    return json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('sessionId')), 'persist', { ownerId, scope: 'class', classId: validateClassId(c.req.param('classId')) }) } });
  });

  app.get('/general-quizzes/live-sessions/:sessionId', requireAuth, async (c) => {
    const ownerId = await host(c);
    return json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('sessionId')), 'host', { ownerId, scope: 'general' }) } });
  });
  app.post('/general-quizzes/live-sessions/:sessionId/action', requireAuth, async (c) => {
    const ownerId = await host(c);
    return json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('sessionId')), 'advance', { ownerId, scope: 'general', ...validateLiveAction(await body(c)) }) } });
  });
  app.post('/general-quizzes/live-sessions/:sessionId/socket-ticket', requireAuth, async (c) => {
    const ownerId = await host(c);
    return json(c, 200, { data: { socket: await room(c, validateLiveCode(c.req.param('sessionId')), 'socket-ticket', { ownerId, scope: 'general' }) } });
  });
  app.post('/general-quizzes/live-sessions/:sessionId/persist', requireAuth, async (c) => {
    const ownerId = await host(c);
    return json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('sessionId')), 'persist', { ownerId, scope: 'general' }) } });
  });

  app.get('/live-quizzes/:code/socket', async (c) => roomSocket(c, validateLiveCode(c.req.param('code'))));
  app.get('/live-quizzes/:code', async (c) => json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('code')), 'public') } }));
  app.post('/live-quizzes/:code/join', optionalAuth, async (c) => {
    const code = validateLiveCode(c.req.param('code'));
    const studentId = await optionalStudentIdentity(c, code);
    return json(c, 201, { data: await room(c, code, 'join', { ...validateLiveJoin(await body(c)), ipHash: await ipHash(c), studentId }) });
  });
  app.post('/live-quizzes/:code/answer', async (c) => json(c, 202, { data: { receipt: await room(c, validateLiveCode(c.req.param('code')), 'answer', validateLiveAnswer(await body(c))) } }));
  app.post('/live-quizzes/:code/result', async (c) => json(c, 200, { data: { result: await room(c, validateLiveCode(c.req.param('code')), 'result', validateLiveParticipantSession(await body(c))) } }));
  app.post('/live-quizzes/:code/state', async (c) => json(c, 200, { data: { session: await room(c, validateLiveCode(c.req.param('code')), 'participant', validateLiveParticipantSession(await body(c))) } }));

  app.get('/classes/:classId/live-results', requireAuth, async (c) => {
    await assertAccountRole(c, 'teacher');
    return json(c, 200, { data: { sessions: await results(c).listClass(validateClassId(c.req.param('classId')), getAuth(c).uid) } });
  });
  app.get('/classes/:classId/live-results/:sessionId', requireAuth, async (c) => {
    await assertAccountRole(c, 'teacher');
    return json(c, 200, { data: { result: await results(c).getClass(validateClassId(c.req.param('classId')), validateLiveCode(c.req.param('sessionId')), getAuth(c).uid) } });
  });
  app.get('/classes/:classId/live-results/:sessionId/export', requireAuth, async (c) => {
    await assertAccountRole(c, 'teacher');
    return csvResponse(await results(c).getClass(validateClassId(c.req.param('classId')), validateLiveCode(c.req.param('sessionId')), getAuth(c).uid));
  });

  app.get('/general-quizzes/live-results', requireAuth, async (c) => {
    const ownerId = await host(c);
    return json(c, 200, { data: { sessions: await results(c).listGeneral(ownerId) } });
  });
  app.get('/general-quizzes/live-results/:sessionId', requireAuth, async (c) => {
    const ownerId = await host(c);
    return json(c, 200, { data: { result: await results(c).getGeneral(validateLiveCode(c.req.param('sessionId')), ownerId) } });
  });
  app.get('/general-quizzes/live-results/:sessionId/export', requireAuth, async (c) => {
    const ownerId = await host(c);
    return csvResponse(await results(c).getGeneral(validateLiveCode(c.req.param('sessionId')), ownerId));
  });
}
