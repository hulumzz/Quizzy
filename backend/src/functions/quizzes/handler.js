import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, HttpError } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateClassId } from '../../validation/class.js';
import { validateAttempt, validateQuizId, validateQuizInput } from '../../validation/quiz.js';
import { validateOptionalLearningSessionId } from '../../validation/learning-session.js';

const methodOf = (event) => (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase();
const pathOf = (event) => (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/';
function bodyOf(event) {
  if (!event?.body) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (event.body.length > 196608) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data kuis terlalu besar.');
  try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); }
  catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); }
}

export function createQuizzesHandler({ authenticate, repository, logger = console }) {
  return async function quizzesHandler(event, context = {}) {
    const method = methodOf(event);
    const path = pathOf(event);
    const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID();
    const startedAt = Date.now();
    const collection = path.match(/^\/classes\/([^/]+)\/quizzes$/);
    const importQuiz = path.match(/^\/classes\/([^/]+)\/quizzes\/import$/);
    const attempts = path.match(/^\/classes\/([^/]+)\/quizzes\/([^/]+)\/attempts$/);
    const results = path.match(/^\/classes\/([^/]+)\/quizzes\/([^/]+)\/results$/);
    const exportQuiz = path.match(/^\/classes\/([^/]+)\/quizzes\/([^/]+)\/export$/);
    const quiz = path.match(/^\/classes\/([^/]+)\/quizzes\/([^/]+)$/);
    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (!collection && !importQuiz && !attempts && !results && !exportQuiz && !quiz) return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, requestId);
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan ruang kuis.');
      if (collection && method === 'GET') return jsonResponse(200, { data: { quizzes: await repository.list(validateClassId(collection[1]), identity.uid) } }, requestId);
      if (collection && method === 'POST') {
        const body = bodyOf(event);
        return jsonResponse(201, { data: { quiz: await repository.create({ classId: validateClassId(collection[1]), ownerId: identity.uid, ...validateQuizInput(body), sessionId: validateOptionalLearningSessionId(body.sessionId) }) } }, requestId);
      }
      if (importQuiz && method === 'POST') {
        const payload = bodyOf(event);
        const source = payload?.quiz && typeof payload.quiz === 'object' && !Array.isArray(payload.quiz) ? payload.quiz : payload;
        return jsonResponse(201, { data: { quiz: await repository.create({ classId: validateClassId(importQuiz[1]), ownerId: identity.uid, ...validateQuizInput({ ...source, status: 'draft' }) }) } }, requestId);
      }
      if (attempts && method === 'POST') return jsonResponse(201, { data: { result: await repository.submit({ classId: validateClassId(attempts[1]), quizId: validateQuizId(attempts[2]), uid: identity.uid, ...validateAttempt(bodyOf(event)) }) } }, requestId);
      if (results && method === 'GET') return jsonResponse(200, { data: { results: await repository.getResult(validateClassId(results[1]), validateQuizId(results[2]), identity.uid) } }, requestId);
      if (exportQuiz && method === 'GET') return jsonResponse(200, { data: await repository.exportForOwner(validateClassId(exportQuiz[1]), validateQuizId(exportQuiz[2]), identity.uid) }, requestId);
      if (quiz && method === 'GET') return jsonResponse(200, { data: { quiz: await repository.get(validateClassId(quiz[1]), validateQuizId(quiz[2]), identity.uid) } }, requestId);
      if (quiz && method === 'PUT') {
        const body = bodyOf(event);
        return jsonResponse(200, { data: { quiz: await repository.update({ classId: validateClassId(quiz[1]), quizId: validateQuizId(quiz[2]), ownerId: identity.uid, ...validateQuizInput(body), sessionId: validateOptionalLearningSessionId(body.sessionId) }) } }, requestId);
      }
      if (quiz && method === 'DELETE') { await repository.remove(validateClassId(quiz[1]), validateQuizId(quiz[2]), identity.uid); return emptyResponse(204, requestId); }
      return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
    } catch (caught) {
      const error = caught instanceof HttpError ? caught : new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada layanan Quizzy.');
      logger.error(JSON.stringify({ requestId, function: 'quizzes', status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
