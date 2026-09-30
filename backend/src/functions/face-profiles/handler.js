import { randomUUID } from 'node:crypto';
import { forbidden, HttpError } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateFaceProfileInput } from '../../validation/face-profile.js';

function methodOf(event) {
  return (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase();
}

function pathOf(event) {
  return (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/';
}

function parseBody(event) {
  if (!event?.body) throw new HttpError(400, 'INVALID_BODY', 'Data profil wajah wajib diisi.');
  if (event.body.length > 32768) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data profil wajah terlalu besar.');
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Format profil wajah tidak valid.');
  }
}

function normalizedError(error) {
  return error instanceof HttpError ? error : new HttpError(500, 'INTERNAL_ERROR', 'Profil wajah belum dapat diproses.');
}

export function createFaceProfilesHandler({ authenticate, repository, logger = console }) {
  return async function faceProfilesHandler(event, context = {}) {
    const method = methodOf(event);
    const path = pathOf(event);
    const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID();
    const startedAt = Date.now();
    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (path !== '/me/face-profile') return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, requestId);
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan profil wajah.');
      if (method === 'GET') return jsonResponse(200, { data: { profile: await repository.get(identity.uid) } }, requestId);
      if (method === 'PUT') {
        const profile = await repository.save({ uid: identity.uid, ...validateFaceProfileInput(parseBody(event)) });
        return jsonResponse(200, { data: { profile } }, requestId);
      }
      if (method === 'DELETE') {
        await repository.remove(identity.uid);
        return emptyResponse(204, requestId);
      }
      return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
    } catch (caught) {
      const error = normalizedError(caught);
      logger.error(JSON.stringify({ requestId, function: 'face-profile', status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
