import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, HttpError } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateAttendanceId, validateAttendanceInput, validateAttendanceStatus, validateCheckIn } from '../../validation/attendance.js';
import { validateClassId } from '../../validation/class.js';

function methodOf(event) {
  return (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase();
}

function pathOf(event) {
  return (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/';
}

function parseBody(event) {
  if (!event?.body) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (event.body.length > 8192) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data presensi terlalu besar.');
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch {
    throw badRequest('INVALID_JSON', 'Format data presensi tidak valid.');
  }
}

function normalizedError(error) {
  return error instanceof HttpError ? error : new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada layanan Quizzy.');
}

function displayName(identity) {
  const fromEmail = identity.email?.split('@')[0]?.replace(/[._-]+/g, ' ');
  return (identity.name || fromEmail || 'Siswa Quizzy').trim().slice(0, 80);
}

export function createAttendanceHandler({ authenticate, repository, logger = console }) {
  return async function attendanceHandler(event, context = {}) {
    const method = methodOf(event);
    const path = pathOf(event);
    const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID();
    const startedAt = Date.now();
    const collection = path.match(/^\/classes\/([^/]+)\/attendance$/);
    const statusRoute = path.match(/^\/classes\/([^/]+)\/attendance\/([^/]+)\/status$/);
    const checkInRoute = path.match(/^\/classes\/([^/]+)\/attendance\/([^/]+)\/check-in$/);
    const detailRoute = path.match(/^\/classes\/([^/]+)\/attendance\/([^/]+)$/);

    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (!collection && !statusRoute && !checkInRoute && !detailRoute) {
        return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, requestId);
      }
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan presensi.');
      const route = collection || statusRoute || checkInRoute || detailRoute;
      const classId = validateClassId(route[1]);

      if (collection && method === 'GET') {
        const attendance = await repository.list(classId, identity.uid);
        return jsonResponse(200, { data: { attendance } }, requestId);
      }
      if (collection && method === 'POST') {
        const input = validateAttendanceInput(parseBody(event));
        const attendance = await repository.create({ classId, ownerId: identity.uid, ...input });
        return jsonResponse(201, { data: { attendance } }, requestId);
      }
      if (detailRoute && method === 'GET') {
        const attendance = await repository.detail(classId, validateAttendanceId(detailRoute[2]), identity.uid);
        return jsonResponse(200, { data: { attendance } }, requestId);
      }
      if (statusRoute && method === 'PUT') {
        const { status } = validateAttendanceStatus(parseBody(event));
        const attendance = await repository.setStatus({ classId, attendanceId: validateAttendanceId(statusRoute[2]), ownerId: identity.uid, status });
        return jsonResponse(200, { data: { attendance } }, requestId);
      }
      if (checkInRoute && method === 'POST') {
        const location = validateCheckIn(parseBody(event));
        const checkIn = await repository.checkIn({
          classId,
          attendanceId: validateAttendanceId(checkInRoute[2]),
          uid: identity.uid,
          name: displayName(identity),
          ...location,
        });
        return jsonResponse(200, { data: { checkIn } }, requestId);
      }
      return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
    } catch (caught) {
      const error = normalizedError(caught);
      logger.error(JSON.stringify({ requestId, function: 'attendance', status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
