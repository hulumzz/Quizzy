import { randomUUID } from 'node:crypto';
import { HttpError, badRequest, forbidden } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateClassId } from '../../validation/class.js';
import { validateQuizId } from '../../validation/quiz.js';
import { validateLiveAction, validateLiveAnswer, validateLiveCode, validateLiveJoin, validateLiveSessionInput } from '../../validation/live-quiz.js';

const methodOf = (event) => (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase();
const pathOf = (event) => (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/';
const sourceIpOf = (event) => event?.requestContext?.http?.sourceIp || event?.requestContext?.identity?.sourceIp || 'unknown';
function bodyOf(event) {
  if (!event?.body) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (event.body.length > 8192) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data sesi terlalu besar.');
  try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); }
  catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); }
}

export function createLiveQuizzesHandler({ authenticate, repository, answerQueue, logger = console }) {
  return async function liveQuizzesHandler(event, context = {}) {
    const method = methodOf(event); const path = pathOf(event); const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID(); const startedAt = Date.now();
    const create = path.match(/^\/classes\/([^/]+)\/quizzes\/([^/]+)\/live-sessions$/);
    const host = path.match(/^\/classes\/([^/]+)\/live-sessions\/([^/]+)$/);
    const action = path.match(/^\/classes\/([^/]+)\/live-sessions\/([^/]+)\/action$/);
    const publicSession = path.match(/^\/live-quizzes\/([^/]+)$/);
    const join = path.match(/^\/live-quizzes\/([^/]+)\/join$/);
    const answer = path.match(/^\/live-quizzes\/([^/]+)\/answer$/);
    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (!create && !host && !action && !publicSession && !join && !answer) return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, requestId);
      if (publicSession && method === 'GET') return jsonResponse(200, { data: { session: await repository.publicStateByCode(validateLiveCode(publicSession[1])) } }, requestId);
      if (join && method === 'POST') return jsonResponse(201, { data: await repository.join({ joinCode: validateLiveCode(join[1]), sourceIp: sourceIpOf(event), ...validateLiveJoin(bodyOf(event)) }) }, requestId);
      if (answer && method === 'POST') {
        if (!answerQueue) throw new HttpError(503, 'LIVE_ANSWER_QUEUE_UNAVAILABLE', 'Layanan jawaban kuis sedang tidak tersedia.');
        const accepted = await repository.authorizeAnswer({ joinCode: validateLiveCode(answer[1]), ...validateLiveAnswer(bodyOf(event)) });
        return jsonResponse(202, { data: { receipt: await answerQueue.enqueue(accepted) } }, requestId);
      }
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menjadi host kuis.');
      if (create && method === 'POST') return jsonResponse(201, { data: { session: await repository.create({ classId: validateClassId(create[1]), quizId: validateQuizId(create[2]), ownerId: identity.uid, ...validateLiveSessionInput(event.body ? bodyOf(event) : {}) }) } }, requestId);
      if (host && method === 'GET') return jsonResponse(200, { data: { session: await repository.hostStateById(host[2], identity.uid) } }, requestId);
      if (action && method === 'POST') return jsonResponse(200, { data: { session: await repository.advance({ sessionId: host ? host[2] : action[2], ownerId: identity.uid, ...validateLiveAction(bodyOf(event)) }) } }, requestId);
      return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
    } catch (caught) {
      const error = caught instanceof HttpError ? caught : new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada layanan Quizzy.');
      logger.error(JSON.stringify({ requestId, function: 'live-quizzes', status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
