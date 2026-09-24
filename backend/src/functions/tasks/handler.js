import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, HttpError } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateClassId } from '../../validation/class.js';
import { validateGradeInput, validateSubmissionInput, validateTaskId, validateTaskInput } from '../../validation/task.js';
import { validateUploadIntent } from '../../validation/upload.js';

function methodOf(event) { return (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase(); }
function pathOf(event) { return (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/'; }
function parseBody(event) {
  if (!event?.body) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (event.body.length > 65536) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data tugas terlalu besar.');
  try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); }
  catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); }
}
function displayName(identity) { return (identity.name || identity.email?.split('@')[0] || 'Siswa Quizzy').trim().slice(0, 80); }
function normalized(error) { return error instanceof HttpError ? error : new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada layanan Quizzy.'); }

export function createTasksHandler({ authenticate, repository, signer, logger = console }) {
  return async function tasksHandler(event, context = {}) {
    const method = methodOf(event); const path = pathOf(event); const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID(); const startedAt = Date.now();
    const collection = path.match(/^\/classes\/([^/]+)\/tasks$/);
    const signature = path.match(/^\/classes\/([^/]+)\/tasks\/([^/]+)\/uploads\/signature$/);
    const submissions = path.match(/^\/classes\/([^/]+)\/tasks\/([^/]+)\/submissions$/);
    const grade = path.match(/^\/classes\/([^/]+)\/tasks\/([^/]+)\/submissions\/([^/]+)$/);
    const ownSubmission = path.match(/^\/classes\/([^/]+)\/tasks\/([^/]+)\/submission$/);
    const item = path.match(/^\/classes\/([^/]+)\/tasks\/([^/]+)$/);
    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (!collection && !signature && !submissions && !grade && !ownSubmission && !item) return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, requestId);
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan tugas.');
      const route = collection || signature || submissions || grade || ownSubmission || item;
      const classId = validateClassId(route[1]);
      if (collection && method === 'GET') return jsonResponse(200, { data: { tasks: await repository.list(classId, identity.uid) } }, requestId);
      if (collection && method === 'POST') return jsonResponse(201, { data: { task: await repository.create({ classId, ownerId: identity.uid, ...validateTaskInput(parseBody(event)) }) } }, requestId);
      if (item && method === 'GET') return jsonResponse(200, { data: { task: await repository.get(classId, validateTaskId(item[2]), identity.uid) } }, requestId);
      if (item && method === 'PUT') return jsonResponse(200, { data: { task: await repository.update({ classId, taskId: validateTaskId(item[2]), ownerId: identity.uid, ...validateTaskInput(parseBody(event)) }) } }, requestId);
      if (signature && method === 'POST') {
        const taskId = validateTaskId(signature[2]); const intent = validateUploadIntent(parseBody(event));
        await repository.prepareAttachmentUpload({ classId, taskId, uid: identity.uid });
        return jsonResponse(200, { data: { upload: await signer.createTaskSubmissionSignature({ classId, taskId, uid: identity.uid, resourceType: intent.resourceType }) } }, requestId);
      }
      if (ownSubmission && method === 'POST') return jsonResponse(200, { data: { submission: await repository.submit({ classId, taskId: validateTaskId(ownSubmission[2]), uid: identity.uid, studentName: displayName(identity), ...validateSubmissionInput(parseBody(event)) }) } }, requestId);
      if (submissions && method === 'GET') return jsonResponse(200, { data: { submissions: await repository.listSubmissions({ classId, taskId: validateTaskId(submissions[2]), ownerId: identity.uid }) } }, requestId);
      if (grade && method === 'PUT') return jsonResponse(200, { data: { submission: await repository.grade({ classId, taskId: validateTaskId(grade[2]), studentId: grade[3], ownerId: identity.uid, ...validateGradeInput(parseBody(event)) }) } }, requestId);
      return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
    } catch (caught) {
      const error = normalized(caught); logger.error(JSON.stringify({ requestId, function: 'tasks', status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
