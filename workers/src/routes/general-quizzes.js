import { badRequest, forbidden, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { GeneralQuizRepository } from '../repositories/general-quiz.repository.js';
import { validateQuizId, validateQuizInput } from '../validation/quizzes.js';

async function body(c) {
  if (Number(c.req.header('content-length') || 0) > 196_608) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data kuis terlalu besar.');
  const raw = await c.req.text();
  if (!raw) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (raw.length > 196_608) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data kuis terlalu besar.');
  try { return JSON.parse(raw); } catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); }
}
function owner(c) { const auth = getAuth(c); if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat mengelola kuis umum.'); return auth.uid; }
export function registerGeneralQuizRoutes(app) {
  const base = '/general-quizzes';
  const repository = (c) => new GeneralQuizRepository(c.env.DB);
  app.get(base, requireAuth, async (c) => json(c, 200, { data: { quizzes: await repository(c).list(owner(c)) } }));
  app.post(base, requireAuth, async (c) => json(c, 201, { data: { quiz: await repository(c).create({ ownerId: owner(c), ...validateQuizInput(await body(c)) }) } }));
  app.get(`${base}/:quizId`, requireAuth, async (c) => json(c, 200, { data: { quiz: await repository(c).get(owner(c), validateQuizId(c.req.param('quizId'))) } }));
  app.put(`${base}/:quizId`, requireAuth, async (c) => json(c, 200, { data: { quiz: await repository(c).update({ ownerId: owner(c), quizId: validateQuizId(c.req.param('quizId')), ...validateQuizInput(await body(c)) }) } }));
  app.delete(`${base}/:quizId`, requireAuth, async (c) => { await repository(c).remove(owner(c), validateQuizId(c.req.param('quizId'))); return c.body(null, 204); });
}
