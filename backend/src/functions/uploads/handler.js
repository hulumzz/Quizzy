import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, HttpError } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateClassId } from '../../validation/class.js';
import { validateUploadIntent } from '../../validation/upload.js';

function parseBody(event) {
  if (!event?.body) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); }
  catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); }
}

export function createUploadsHandler({ authenticate, signer, logger = console }) {
  return async function uploadsHandler(event, context = {}) {
    const method = (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase();
    const path = (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/';
    const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID();
    const startedAt = Date.now();
    const signatureRoute = path.match(/^\/classes\/([^/]+)\/uploads\/signature$/);
    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (!signatureRoute) return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, requestId);
      if (method !== 'POST') return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat mengunggah aset.');
      const intent = validateUploadIntent(parseBody(event));
      const upload = await signer.createSignature({ classId: validateClassId(signatureRoute[1]), uid: identity.uid, resourceType: intent.resourceType });
      return jsonResponse(200, { data: { upload } }, requestId);
    } catch (caught) {
      const error = caught instanceof HttpError ? caught : new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada layanan Quizzy.');
      logger.error(JSON.stringify({ requestId, function: 'uploads', status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
