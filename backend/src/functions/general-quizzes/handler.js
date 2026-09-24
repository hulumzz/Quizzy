import { randomUUID } from 'node:crypto';
import { forbidden, HttpError } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateQuizId, validateQuizInput } from '../../validation/quiz.js';

const methodOf = (event) => (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase();
const pathOf = (event) => (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/';
function bodyOf(event) {
  if (!event?.body) throw new HttpError(400, 'INVALID_BODY', 'Data permintaan wajib diisi.');
  if (event.body.length > 196608) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data kuis terlalu besar.');
  try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); }
  catch { throw new HttpError(400, 'INVALID_JSON', 'Format data tidak valid.'); }
}

export function createGeneralQuizzesHandler({ authenticate, repository, logger = console }) {
  return async function generalQuizzesHandler(event, context = {}) {
    const method = methodOf(event); const path = pathOf(event); const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID(); const startedAt = Date.now();
    const detail = path.match(/^\/general-quizzes\/([^/]+)$/);
    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (path !== '/general-quizzes' && !detail) return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint kuis umum tidak ditemukan.' } }, requestId);
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat mengelola kuis umum.');
      if (path === '/general-quizzes' && method === 'GET') return jsonResponse(200, { data: { quizzes: await repository.list(identity.uid) } }, requestId);
      if (path === '/general-quizzes' && method === 'POST') return jsonResponse(201, { data: { quiz: await repository.create({ ownerId: identity.uid, ...validateQuizInput(bodyOf(event)) }) } }, requestId);
      if (detail && method === 'GET') return jsonResponse(200, { data: { quiz: await repository.get(identity.uid, validateQuizId(detail[1])) } }, requestId);
      if (detail && method === 'PUT') return jsonResponse(200, { data: { quiz: await repository.update({ ownerId: identity.uid, quizId: validateQuizId(detail[1]), ...validateQuizInput(bodyOf(event)) }) } }, requestId);
      if (detail && method === 'DELETE') { await repository.remove(identity.uid, validateQuizId(detail[1])); return emptyResponse(204, requestId); }
      return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
    } catch (caught) {
      const error = caught instanceof HttpError ? caught : new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada layanan Quizzy.');
      logger.error(JSON.stringify({ requestId, function: 'general-quizzes', status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
