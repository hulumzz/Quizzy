import { randomUUID } from 'node:crypto';
import { forbidden, HttpError } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { QUIZ_LEVELS, QUIZ_SUBJECTS } from '../../domain/quiz-taxonomy.js';
import { validateQuizBankCatalogId, validateQuizBankCopy, validateQuizBankPublish, validateQuizBankQuery } from '../../validation/quiz-bank.js';

const methodOf = (event) => (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase();
const pathOf = (event) => (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/';
const queryOf = (event) => event?.queryStringParameters || {};
function bodyOf(event) {
  if (!event?.body) throw new HttpError(400, 'INVALID_BODY', 'Data permintaan wajib diisi.');
  if (event.body.length > 16384) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data Bank Kuis terlalu besar.');
  try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); } catch { throw new HttpError(400, 'INVALID_JSON', 'Format data tidak valid.'); }
}

export function createQuizBankHandler({ authenticate, repository, logger = console }) {
  return async function quizBankHandler(event, context = {}) {
    const method = methodOf(event); const path = pathOf(event); const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID(); const startedAt = Date.now();
    const catalog = path.match(/^\/quiz-bank\/([^/]+)$/); const copy = path.match(/^\/quiz-bank\/([^/]+)\/copy$/);
    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan Bank Kuis.');
      if (path === '/quiz-bank/taxonomy' && method === 'GET') return jsonResponse(200, { data: { levels: QUIZ_LEVELS, subjects: QUIZ_SUBJECTS } }, requestId);
      if (path === '/quiz-bank/mine' && method === 'GET') return jsonResponse(200, { data: { quizzes: await repository.listMine(identity.uid) } }, requestId);
      if (path === '/quiz-bank' && method === 'GET') return jsonResponse(200, { data: { quizzes: await repository.list(validateQuizBankQuery(queryOf(event))) } }, requestId);
      if (path === '/quiz-bank/publish' && method === 'POST') return jsonResponse(201, { data: { quiz: await repository.publish({ ownerId: identity.uid, ...validateQuizBankPublish(bodyOf(event)) }) } }, requestId);
      if (copy && method === 'POST') return jsonResponse(201, { data: { quiz: await repository.copyToClass({ catalogId: validateQuizBankCatalogId(copy[1]), ownerId: identity.uid, ...validateQuizBankCopy(bodyOf(event)) }) } }, requestId);
      if (catalog && method === 'DELETE') { await repository.unpublish({ catalogId: validateQuizBankCatalogId(catalog[1]), ownerId: identity.uid }); return emptyResponse(204, requestId); }
      return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint Bank Kuis tidak ditemukan.' } }, requestId);
    } catch (caught) {
      const error = caught instanceof HttpError ? caught : new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada Bank Kuis.');
      logger.error(JSON.stringify({ requestId, function: 'quiz-bank', status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
