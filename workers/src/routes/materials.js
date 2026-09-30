import { badRequest, forbidden, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { MaterialRepository } from '../repositories/material.repository.js';
import { LearningSessionRepository } from '../repositories/learning-session.repository.js';
import { CloudinaryUploadSigner } from '../services/cloudinary.js';
import { validateClassId } from '../validation/classes.js';
import { validateMaterialId, validateMaterialInput, validateProgress, validateUploadIntent } from '../validation/materials.js';

const MAX_BODY_BYTES = 98_304;
async function body(c, message = 'Data permintaan wajib diisi.') { const raw = await c.req.text(); if (!raw) throw badRequest('INVALID_BODY', message); if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data materi terlalu besar.'); try { return JSON.parse(raw); } catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); } }
function repositories(c) { const classes = new ClassRepository(c.env.DB); return { classes, materials: new MaterialRepository({ db: c.env.DB, classRepository: classes, learningSessionRepository: new LearningSessionRepository({ db: c.env.DB, classRepository: classes }) }) }; }

export function registerMaterialRoutes(app) {
  app.get('/classes/:classId/materials', requireAuth, async (c) => json(c, 200, { data: { materials: await repositories(c).materials.list(validateClassId(c.req.param('classId')), getAuth(c).uid) } }));
  app.post('/classes/:classId/materials', requireAuth, async (c) => { const auth = getAuth(c); if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan ruang materi.'); const material = await repositories(c).materials.create({ classId: validateClassId(c.req.param('classId')), ownerId: auth.uid, ...validateMaterialInput(await body(c)) }); return json(c, 201, { data: { material } }); });
  app.get('/classes/:classId/materials/:materialId', requireAuth, async (c) => json(c, 200, { data: { material: await repositories(c).materials.get(validateClassId(c.req.param('classId')), validateMaterialId(c.req.param('materialId')), getAuth(c).uid) } }));
  app.put('/classes/:classId/materials/:materialId', requireAuth, async (c) => { const material = await repositories(c).materials.update({ classId: validateClassId(c.req.param('classId')), materialId: validateMaterialId(c.req.param('materialId')), ownerId: getAuth(c).uid, ...validateMaterialInput(await body(c)) }); return json(c, 200, { data: { material } }); });
  app.delete('/classes/:classId/materials/:materialId', requireAuth, async (c) => { await repositories(c).materials.remove(validateClassId(c.req.param('classId')), validateMaterialId(c.req.param('materialId')), getAuth(c).uid); return c.body(null, 204); });
  app.put('/classes/:classId/materials/:materialId/progress', requireAuth, async (c) => json(c, 200, { data: { progress: await repositories(c).materials.setProgress({ classId: validateClassId(c.req.param('classId')), materialId: validateMaterialId(c.req.param('materialId')), uid: getAuth(c).uid, ...validateProgress(await body(c)) }) } }));
  app.on(['PUT', 'DELETE'], '/classes/:classId/materials/:materialId/bookmark', requireAuth, async (c) => json(c, 200, { data: await repositories(c).materials.setBookmark({ classId: validateClassId(c.req.param('classId')), materialId: validateMaterialId(c.req.param('materialId')), uid: getAuth(c).uid, saved: c.req.method === 'PUT' }) }));
  app.get('/learning/bookmarks', requireAuth, async (c) => json(c, 200, { data: { materials: await repositories(c).materials.listUserState(getAuth(c).uid, 'bookmarks') } }));
  app.get('/learning/progress', requireAuth, async (c) => json(c, 200, { data: { materials: await repositories(c).materials.listUserState(getAuth(c).uid, 'progress') } }));
  app.post('/classes/:classId/uploads/signature', requireAuth, async (c) => { const auth = getAuth(c); if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat mengunggah aset.'); const { classes } = repositories(c); const upload = await new CloudinaryUploadSigner({ classRepository: classes, cloudName: c.env.CLOUDINARY_CLOUD_NAME, apiKey: c.env.CLOUDINARY_API_KEY, apiSecret: c.env.CLOUDINARY_API_SECRET }).createSignature({ classId: validateClassId(c.req.param('classId')), uid: auth.uid, resourceType: validateUploadIntent(await body(c)).resourceType }); return json(c, 200, { data: { upload } }); });
  app.post('/general-quizzes/uploads/signature', requireAuth, async (c) => { const auth = getAuth(c); if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat mengunggah aset kuis.'); const intent = validateUploadIntent(await body(c)); const upload = await new CloudinaryUploadSigner({ classRepository: null, cloudName: c.env.CLOUDINARY_CLOUD_NAME, apiKey: c.env.CLOUDINARY_API_KEY, apiSecret: c.env.CLOUDINARY_API_SECRET }).createGeneralQuizSignature({ uid: auth.uid, resourceType: intent.resourceType }); return json(c, 200, { data: { upload } }); });
}
