import { badRequest, forbidden, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { assertAccountRole, getAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { LearningSessionRepository } from '../repositories/learning-session.repository.js';
import { validateClassId } from '../validation/classes.js';
import { validateLearningSessionId, validateLearningSessionInput, validateLearningSessionOrder } from '../validation/learning-sessions.js';
const MAX_BODY_BYTES = 16_384;
async function body(c) { if (Number(c.req.header('content-length') || 0) > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data pertemuan terlalu besar.'); const raw = await c.req.text(); if (!raw) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.'); if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data pertemuan terlalu besar.'); try { return JSON.parse(raw); } catch { throw badRequest('INVALID_JSON', 'Format data pertemuan tidak valid.'); } }
function repository(c) { return new LearningSessionRepository({ db: c.env.DB, classRepository: new ClassRepository(c.env.DB) }); }
export function registerLearningSessionRoutes(app) { const base = '/classes/:classId/sessions'; const classId = (c) => validateClassId(c.req.param('classId')); const identity = (c) => { const auth = getAuth(c); if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan ruang pertemuan.'); return auth; };
  app.get(base, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { sessions: await repository(c).list(classId(c), auth.uid) } }); });
  app.post(base, requireAuth, async (c) => { const auth = identity(c); await assertAccountRole(c, 'teacher'); const session = await repository(c).create({ classId: classId(c), ownerId: auth.uid, ...validateLearningSessionInput(await body(c)) }); return json(c, 201, { data: { session } }); });
  app.put(`${base}/reorder`, requireAuth, async (c) => { const auth = identity(c); await assertAccountRole(c, 'teacher'); const sessions = await repository(c).reorder({ classId: classId(c), ownerId: auth.uid, ...validateLearningSessionOrder(await body(c)) }); return json(c, 200, { data: { sessions } }); });
  app.get(`${base}/:sessionId`, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { session: await repository(c).get(classId(c), validateLearningSessionId(c.req.param('sessionId')), auth.uid) } }); });
  app.put(`${base}/:sessionId`, requireAuth, async (c) => { const auth = identity(c); await assertAccountRole(c, 'teacher'); const session = await repository(c).update({ classId: classId(c), sessionId: validateLearningSessionId(c.req.param('sessionId')), ownerId: auth.uid, ...validateLearningSessionInput(await body(c)) }); return json(c, 200, { data: { session } }); });
}
