import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, HttpError } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateClassId } from '../../validation/class.js';
import { validateLearningSessionId, validateLearningSessionInput, validateLearningSessionOrder } from '../../validation/learning-session.js';

const methodOf = (event) => (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase();
const pathOf = (event) => (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/';

function bodyOf(event) {
  if (!event?.body) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (event.body.length > 16384) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data pertemuan terlalu besar.');
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
  } catch {
    throw badRequest('INVALID_JSON', 'Format data pertemuan tidak valid.');
  }
}

export function createLearningSessionsHandler({ authenticate, repository, logger = console }) {
  return async function learningSessionsHandler(event, context = {}) {
    const method = methodOf(event);
    const path = pathOf(event);
    const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID();
    const startedAt = Date.now();
    const collection = path.match(/^\/classes\/([^/]+)\/sessions$/);
    const reorder = path.match(/^\/classes\/([^/]+)\/sessions\/reorder$/);
    const detail = path.match(/^\/classes\/([^/]+)\/sessions\/([^/]+)$/);

    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (!collection && !reorder && !detail) {
        return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, requestId);
      }
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan ruang pertemuan.');

      const route = collection || reorder || detail;
      const classId = validateClassId(route[1]);

      if (collection && method === 'GET') {
        return jsonResponse(200, { data: { sessions: await repository.list(classId, identity.uid) } }, requestId);
      }
      if (collection && method === 'POST') {
        const session = await repository.create({ classId, ownerId: identity.uid, ...validateLearningSessionInput(bodyOf(event)) });
        return jsonResponse(201, { data: { session } }, requestId);
      }
      if (reorder && method === 'PUT') {
        const sessions = await repository.reorder({ classId, ownerId: identity.uid, ...validateLearningSessionOrder(bodyOf(event)) });
        return jsonResponse(200, { data: { sessions } }, requestId);
      }
      if (detail && method === 'GET') {
        const session = await repository.get(classId, validateLearningSessionId(detail[2]), identity.uid);
        return jsonResponse(200, { data: { session } }, requestId);
      }
      if (detail && method === 'PUT') {
        const session = await repository.update({
          classId,
          sessionId: validateLearningSessionId(detail[2]),
          ownerId: identity.uid,
          ...validateLearningSessionInput(bodyOf(event)),
        });
        return jsonResponse(200, { data: { session } }, requestId);
      }
      return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
    } catch (caught) {
      const error = caught instanceof HttpError ? caught : new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada layanan Quizzy.');
      logger.error(JSON.stringify({ requestId, function: 'learning-sessions', status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
