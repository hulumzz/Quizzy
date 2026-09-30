import { badRequest, forbidden, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { DiscussionRepository } from '../repositories/discussion.repository.js';
import { MaterialRepository } from '../repositories/material.repository.js';
import { validateClassId } from '../validation/classes.js';
import { validateDiscussionId, validateDiscussionInput, validateDiscussionStatus } from '../validation/discussions.js';
import { validateMaterialId } from '../validation/materials.js';

const MAX_BODY_BYTES = 24_576;

async function body(c) {
  if (Number(c.req.header('content-length') || 0) > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Pesan diskusi terlalu besar.');
  const raw = await c.req.text();
  if (!raw) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Pesan diskusi terlalu besar.');
  try { return JSON.parse(raw); } catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); }
}

function authorName(identity) {
  const emailName = identity.email?.split('@')[0]?.replace(/[._-]+/g, ' ');
  return (identity.name || emailName || 'Pengguna Quizzy').trim().slice(0, 80);
}

function repository(c) {
  const classes = new ClassRepository(c.env.DB);
  const materials = new MaterialRepository({ db: c.env.DB, classRepository: classes });
  return new DiscussionRepository({ db: c.env.DB, materialRepository: materials });
}

export function registerDiscussionRoutes(app) {
  const base = '/classes/:classId/materials/:materialId/discussions';
  const ids = (c) => ({ classId: validateClassId(c.req.param('classId')), materialId: validateMaterialId(c.req.param('materialId')) });
  const account = (c) => {
    const auth = getAuth(c);
    if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan ruang diskusi.');
    return auth;
  };

  app.get(base, requireAuth, async (c) => { const auth = account(c); const { classId, materialId } = ids(c); return json(c, 200, { data: await repository(c).list(classId, materialId, auth.uid) }); });
  app.post(base, requireAuth, async (c) => { const auth = account(c); const discussion = await repository(c).create({ ...ids(c), uid: auth.uid, authorName: authorName(auth), ...validateDiscussionInput(await body(c)) }); return json(c, 201, { data: { discussion } }); });
  app.post(`${base}/:discussionId/replies`, requireAuth, async (c) => { const auth = account(c); const reply = await repository(c).reply({ ...ids(c), discussionId: validateDiscussionId(c.req.param('discussionId')), uid: auth.uid, authorName: authorName(auth), ...validateDiscussionInput(await body(c)) }); return json(c, 201, { data: { reply } }); });
  app.put(`${base}/:discussionId/status`, requireAuth, async (c) => { const auth = account(c); const discussion = await repository(c).setStatus({ ...ids(c), discussionId: validateDiscussionId(c.req.param('discussionId')), uid: auth.uid, ...validateDiscussionStatus(await body(c)) }); return json(c, 200, { data: { discussion } }); });
  app.put(`${base}/:discussionId/replies/:replyId`, requireAuth, async (c) => { const auth = account(c); const message = await repository(c).update({ ...ids(c), discussionId: validateDiscussionId(c.req.param('discussionId')), replyId: validateDiscussionId(c.req.param('replyId'), 'replyId'), uid: auth.uid, ...validateDiscussionInput(await body(c)) }); return json(c, 200, { data: { message } }); });
  app.delete(`${base}/:discussionId/replies/:replyId`, requireAuth, async (c) => { const auth = account(c); await repository(c).remove({ ...ids(c), discussionId: validateDiscussionId(c.req.param('discussionId')), replyId: validateDiscussionId(c.req.param('replyId'), 'replyId'), uid: auth.uid }); return c.body(null, 204); });
  app.put(`${base}/:discussionId`, requireAuth, async (c) => { const auth = account(c); const message = await repository(c).update({ ...ids(c), discussionId: validateDiscussionId(c.req.param('discussionId')), uid: auth.uid, ...validateDiscussionInput(await body(c)) }); return json(c, 200, { data: { message } }); });
  app.delete(`${base}/:discussionId`, requireAuth, async (c) => { const auth = account(c); await repository(c).remove({ ...ids(c), discussionId: validateDiscussionId(c.req.param('discussionId')), uid: auth.uid }); return c.body(null, 204); });
}
