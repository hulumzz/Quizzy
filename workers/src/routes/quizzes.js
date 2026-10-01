import { badRequest, forbidden, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { assertAccountRole, getAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { LearningSessionRepository } from '../repositories/learning-session.repository.js';
import { QuizRepository } from '../repositories/quiz.repository.js';
import { validateClassId } from '../validation/classes.js';
import { validateAttempt, validateQuizId, validateQuizInput } from '../validation/quizzes.js';
import { validateLearningSessionId } from '../validation/learning-sessions.js';
const MAX_BODY_BYTES = 196_608;
async function body(c) { if (Number(c.req.header('content-length') || 0) > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data kuis terlalu besar.'); const raw = await c.req.text(); if (!raw) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.'); if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data kuis terlalu besar.'); try { return JSON.parse(raw); } catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); } }
function repository(c) { const classes = new ClassRepository(c.env.DB); return new QuizRepository({ db: c.env.DB, classRepository: classes, learningSessionRepository: new LearningSessionRepository({ db: c.env.DB, classRepository: classes }) }); }
export function registerQuizRoutes(app) { const base = '/classes/:classId/quizzes'; const classId = (c) => validateClassId(c.req.param('classId')); const identity = (c) => { const auth = getAuth(c); if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan ruang kuis.'); return auth; }; const sessionId = (value) => value === null || value === undefined || value === '' ? null : validateLearningSessionId(value);
  app.get(base, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { quizzes: await repository(c).list(classId(c), auth.uid) } }); });
  app.post(base, requireAuth, async (c) => { const auth = identity(c); await assertAccountRole(c, 'teacher'); const raw = await body(c); const quiz = await repository(c).create({ classId: classId(c), ownerId: auth.uid, ...validateQuizInput(raw), sessionId: sessionId(raw.sessionId) }); return json(c, 201, { data: { quiz } }); });
  app.post(`${base}/import`, requireAuth, async (c) => { const auth = identity(c); await assertAccountRole(c, 'teacher'); const payload = await body(c); const source = payload?.quiz && typeof payload.quiz === 'object' && !Array.isArray(payload.quiz) ? payload.quiz : payload; const quiz = await repository(c).create({ classId: classId(c), ownerId: auth.uid, ...validateQuizInput({ ...source, status: 'draft' }) }); return json(c, 201, { data: { quiz } }); });
  app.get(`${base}/:quizId`, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { quiz: await repository(c).get(classId(c), validateQuizId(c.req.param('quizId')), auth.uid) } }); });
  app.put(`${base}/:quizId`, requireAuth, async (c) => { const auth = identity(c); await assertAccountRole(c, 'teacher'); const raw = await body(c); const quiz = await repository(c).update({ classId: classId(c), quizId: validateQuizId(c.req.param('quizId')), ownerId: auth.uid, ...validateQuizInput(raw), sessionId: sessionId(raw.sessionId) }); return json(c, 200, { data: { quiz } }); });
  app.delete(`${base}/:quizId`, requireAuth, async (c) => { const auth = identity(c); await assertAccountRole(c, 'teacher'); await repository(c).remove(classId(c), validateQuizId(c.req.param('quizId')), auth.uid); return c.body(null, 204); });
  app.post(`${base}/:quizId/attempts`, requireAuth, async (c) => { const auth = identity(c); await assertAccountRole(c, 'student'); const result = await repository(c).submit({ classId: classId(c), quizId: validateQuizId(c.req.param('quizId')), uid: auth.uid, ...validateAttempt(await body(c)) }); return json(c, 201, { data: { result } }); });
  app.get(`${base}/:quizId/export`, requireAuth, async (c) => { const auth = identity(c); await assertAccountRole(c, 'teacher'); return json(c, 200, { data: await repository(c).exportForOwner(classId(c), validateQuizId(c.req.param('quizId')), auth.uid) }); });
  app.get(`${base}/:quizId/results`, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { results: await repository(c).getResult(classId(c), validateQuizId(c.req.param('quizId')), auth.uid) } }); });
}
