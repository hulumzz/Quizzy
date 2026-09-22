import { randomUUID } from 'node:crypto';
import { HttpError, badRequest, forbidden } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateClassId, validateCreateClass, validateJoinClass } from '../../validation/class.js';

function requestMethod(event) {
  return event?.requestContext?.http?.method || event?.httpMethod || 'GET';
}

function requestPath(event) {
  return event?.rawPath || event?.path || '/';
}

function headerValue(event, name) {
  const entry = Object.entries(event?.headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

function idempotencyKey(event) {
  const value = headerValue(event, 'x-idempotency-key');
  if (value === undefined) return undefined;
  if (!/^[A-Za-z0-9_-]{8,36}$/.test(value)) throw badRequest('INVALID_IDEMPOTENCY_KEY', 'Kunci permintaan tidak valid.');
  return value;
}

function parseBody(event) {
  if (!event?.body) throw badRequest('INVALID_BODY', 'Data kelas wajib diisi.');
  if (event.body.length > 4096) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data kelas terlalu besar.');
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch {
    throw badRequest('INVALID_JSON', 'Format data kelas tidak valid.');
  }
}

function normalizedError(error) {
  if (error instanceof HttpError) return error;
  return new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada layanan Quizzy.');
}

export function createClassesHandler({ authenticate, repository, logger = console }) {
  return async function classesHandler(event, context = {}) {
    const method = requestMethod(event).toUpperCase();
    const path = requestPath(event).replace(/\/+$/, '') || '/';
    const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID();
    const startedAt = Date.now();
    const isCollection = path === '/classes';
    const isJoin = path === '/classes/join';
    const memberMatch = path.match(/^\/classes\/([^/]+)\/members$/);
    const detailMatch = isJoin ? null : path.match(/^\/classes\/([^/]+)$/);

    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (!isCollection && !isJoin && !memberMatch && !detailMatch) {
        return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, requestId);
      }

      const identity = await authenticate(event);
      if (isCollection && method === 'GET') {
        const scope = event?.queryStringParameters?.scope || 'owned';
        if (!['owned', 'joined'].includes(scope)) throw badRequest('INVALID_SCOPE', 'Pilihan daftar kelas tidak valid.');
        const classes = scope === 'joined'
          ? await repository.listJoinedBy(identity.uid)
          : await repository.listOwnedBy(identity.uid);
        return jsonResponse(200, { data: { classes } }, requestId);
      }
      if (isCollection && method === 'POST') {
        if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat membuat kelas.');
        const input = validateCreateClass(parseBody(event));
        const classItem = await repository.create({
          ownerId: identity.uid,
          teacherName: identity.name || identity.email || 'Guru Quizzy',
          ...input,
        });
        return jsonResponse(201, { data: { class: classItem } }, requestId);
      }
      if (isJoin && method === 'POST') {
        if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat bergabung ke kelas.');
        const input = validateJoinClass(parseBody(event));
        const classItem = await repository.joinByCode({
          uid: identity.uid,
          name: identity.name || identity.email || 'Siswa Quizzy',
          idempotencyKey: idempotencyKey(event),
          ...input,
        });
        return jsonResponse(200, { data: { class: classItem } }, requestId);
      }
      if (memberMatch && method === 'GET') {
        const members = await repository.listMembers(validateClassId(memberMatch[1]), identity.uid);
        return jsonResponse(200, { data: { members } }, requestId);
      }
      if (detailMatch && method === 'GET') {
        const classItem = await repository.getForUser(validateClassId(detailMatch[1]), identity.uid);
        return jsonResponse(200, { data: { class: classItem } }, requestId);
      }
      return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
    } catch (caught) {
      const error = normalizedError(caught);
      logger.error(JSON.stringify({
        requestId,
        function: 'classes',
        operation: isJoin ? 'join' : memberMatch ? 'members' : detailMatch ? 'detail' : method === 'POST' ? 'create' : 'list',
        status: error.statusCode,
        duration: Date.now() - startedAt,
        errorCode: error.code,
      }));
      return jsonResponse(error.statusCode, {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      }, requestId);
    }
  };
}
