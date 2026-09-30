import { badRequest, forbidden, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { LearningSessionRepository } from '../repositories/learning-session.repository.js';
import { TaskRepository } from '../repositories/task.repository.js';
import { CloudinaryUploadSigner } from '../services/cloudinary.js';
import { validateClassId } from '../validation/classes.js';
import { validateUploadIntent } from '../validation/materials.js';
import { validateGradeInput, validateSubmissionInput, validateTaskId, validateTaskInput } from '../validation/tasks.js';
async function body(c) { const raw = await c.req.text(); if (!raw) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.'); if (raw.length > 65_536) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data tugas terlalu besar.'); try { return JSON.parse(raw); } catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); } }
function repository(c) { const classes = new ClassRepository(c.env.DB); return new TaskRepository({ db: c.env.DB, classRepository: classes, learningSessionRepository: new LearningSessionRepository({ db: c.env.DB, classRepository: classes }), cloudName: c.env.CLOUDINARY_CLOUD_NAME }); }
function identity(c) { const auth = getAuth(c); if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan tugas.'); return auth; }
export function registerTaskRoutes(app) { const base = '/classes/:classId/tasks'; const classId = (c) => validateClassId(c.req.param('classId'));
  app.get(base, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { tasks: await repository(c).list(classId(c), auth.uid) } }); });
  app.post(base, requireAuth, async (c) => { const auth = identity(c); return json(c, 201, { data: { task: await repository(c).create({ classId: classId(c), ownerId: auth.uid, ...validateTaskInput(await body(c)) }) } }); });
  app.post(`${base}/:taskId/uploads/signature`, requireAuth, async (c) => { const auth = identity(c); const taskId = validateTaskId(c.req.param('taskId')); const intent = validateUploadIntent(await body(c)); await repository(c).prepareAttachmentUpload({ classId: classId(c), taskId, uid: auth.uid }); const signer = new CloudinaryUploadSigner({ cloudName: c.env.CLOUDINARY_CLOUD_NAME, apiKey: c.env.CLOUDINARY_API_KEY, apiSecret: c.env.CLOUDINARY_API_SECRET }); return json(c, 200, { data: { upload: await signer.createTaskSubmissionSignature({ classId: classId(c), taskId, uid: auth.uid, resourceType: intent.resourceType }) } }); });
  app.get(`${base}/:taskId/submissions`, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { submissions: await repository(c).listSubmissions({ classId: classId(c), taskId: validateTaskId(c.req.param('taskId')), ownerId: auth.uid }) } }); });
  app.put(`${base}/:taskId/submissions/:studentId`, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { submission: await repository(c).grade({ classId: classId(c), taskId: validateTaskId(c.req.param('taskId')), studentId: c.req.param('studentId'), ownerId: auth.uid, ...validateGradeInput(await body(c)) }) } }); });
  app.get(`${base}/:taskId`, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { task: await repository(c).get(classId(c), validateTaskId(c.req.param('taskId')), auth.uid) } }); });
  app.put(`${base}/:taskId`, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { task: await repository(c).update({ classId: classId(c), taskId: validateTaskId(c.req.param('taskId')), ownerId: auth.uid, ...validateTaskInput(await body(c)) }) } }); });
  app.post(`${base}/:taskId/submission`, requireAuth, async (c) => { const auth = identity(c); const submission = await repository(c).submit({ classId: classId(c), taskId: validateTaskId(c.req.param('taskId')), uid: auth.uid, studentName: auth.name || auth.email?.split('@')[0] || 'Siswa Quizzy', ...validateSubmissionInput(await body(c)) }); return json(c, 200, { data: { submission } }); });
}
