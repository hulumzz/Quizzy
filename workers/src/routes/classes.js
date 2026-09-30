import { HttpError, badRequest, forbidden } from '../http/errors.js';
import { json } from '../http/response.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { validateClassId, validateCreateClass, validateJoinClass } from '../validation/classes.js';

const MAX_BODY_BYTES = 4_096;

async function parseBody(c, message) {
  if (Number(c.req.header('content-length') || 0) > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data kelas terlalu besar.');
  const raw = await c.req.text();
  if (!raw) throw badRequest('INVALID_BODY', message);
  if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data kelas terlalu besar.');
  try { return JSON.parse(raw); } catch { throw badRequest('INVALID_JSON', 'Format data kelas tidak valid.'); }
}

function idempotencyKey(c) {
  const value = c.req.header('x-idempotency-key');
  if (value === undefined) return undefined;
  if (!/^[A-Za-z0-9_-]{8,36}$/.test(value)) throw badRequest('INVALID_IDEMPOTENCY_KEY', 'Kunci permintaan tidak valid.');
  return value;
}

export function registerClassRoutes(app, { repositoryFactory = (env) => new ClassRepository(env.DB) } = {}) {
  const repository = (c) => repositoryFactory(c.env);
  app.get('/classes', requireAuth, async (c) => {
    const identity = getAuth(c);
    const scope = c.req.query('scope') || 'owned';
    if (!['owned', 'joined'].includes(scope)) throw badRequest('INVALID_SCOPE', 'Pilihan daftar kelas tidak valid.');
    const classes = scope === 'joined' ? await repository(c).listJoinedBy(identity.uid) : await repository(c).listOwnedBy(identity.uid);
    return json(c, 200, { data: { classes } });
  });
  app.post('/classes', requireAuth, async (c) => {
    const identity = getAuth(c);
    if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat membuat kelas.');
    const input = validateCreateClass(await parseBody(c, 'Data kelas wajib diisi.'));
    const classItem = await repository(c).create({ ownerId: identity.uid, teacherName: identity.name || identity.email || 'Guru Quizzy', ...input });
    return json(c, 201, { data: { class: classItem } });
  });
  app.post('/classes/join', requireAuth, async (c) => {
    const identity = getAuth(c);
    if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat bergabung ke kelas.');
    const input = validateJoinClass(await parseBody(c, 'Data kode kelas wajib diisi.'));
    const classItem = await repository(c).joinByCode({ uid: identity.uid, name: identity.name || identity.email || 'Siswa Quizzy', idempotencyKey: idempotencyKey(c), ...input });
    return json(c, 200, { data: { class: classItem } });
  });
  app.get('/classes/:classId/members', requireAuth, async (c) => json(c, 200, { data: { members: await repository(c).listMembers(validateClassId(c.req.param('classId')), getAuth(c).uid) } }));
  app.get('/classes/:classId', requireAuth, async (c) => json(c, 200, { data: { class: await repository(c).getForUser(validateClassId(c.req.param('classId')), getAuth(c).uid) } }));
}
