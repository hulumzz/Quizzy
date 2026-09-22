import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, HttpError } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateClassId } from '../../validation/class.js';
import { validateMaterialId, validateMaterialInput, validateProgress } from '../../validation/material.js';

function requestMethod(event) {
  return event?.requestContext?.http?.method || event?.httpMethod || 'GET';
}

function requestPath(event) {
  return (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/';
}

function parseBody(event) {
  if (!event?.body) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (event.body.length > 98304) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data materi terlalu besar.');
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch {
    throw badRequest('INVALID_JSON', 'Format data tidak valid.');
  }
}

function normalizedError(error) {
  if (error instanceof HttpError) return error;
  return new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada layanan Quizzy.');
}

export function createMaterialsHandler({ authenticate, repository, logger = console }) {
  return async function materialsHandler(event, context = {}) {
    const method = requestMethod(event).toUpperCase();
    const path = requestPath(event);
    const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID();
    const startedAt = Date.now();
    const collection = path.match(/^\/classes\/([^/]+)\/materials$/);
    const progress = path.match(/^\/classes\/([^/]+)\/materials\/([^/]+)\/progress$/);
    const bookmark = path.match(/^\/classes\/([^/]+)\/materials\/([^/]+)\/bookmark$/);
    const material = path.match(/^\/classes\/([^/]+)\/materials\/([^/]+)$/);
    const savedList = path === '/learning/bookmarks';
    const progressList = path === '/learning/progress';
    const operation = progress ? 'progress' : bookmark ? 'bookmark' : savedList ? 'saved-list' : progressList ? 'progress-list' : material ? 'material' : 'material-list';

    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (!collection && !progress && !bookmark && !material && !savedList && !progressList) {
        return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, requestId);
      }
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan ruang materi.');

      if (collection && method === 'GET') {
        const materials = await repository.list(validateClassId(collection[1]), identity.uid);
        return jsonResponse(200, { data: { materials } }, requestId);
      }
      if (collection && method === 'POST') {
        const input = validateMaterialInput(parseBody(event));
        const created = await repository.create({ classId: validateClassId(collection[1]), ownerId: identity.uid, ...input });
        return jsonResponse(201, { data: { material: created } }, requestId);
      }
      if (material && method === 'GET') {
        const item = await repository.get(validateClassId(material[1]), validateMaterialId(material[2]), identity.uid);
        return jsonResponse(200, { data: { material: item } }, requestId);
      }
      if (material && method === 'PUT') {
        const input = validateMaterialInput(parseBody(event));
        const updated = await repository.update({ classId: validateClassId(material[1]), materialId: validateMaterialId(material[2]), ownerId: identity.uid, ...input });
        return jsonResponse(200, { data: { material: updated } }, requestId);
      }
      if (material && method === 'DELETE') {
        await repository.remove(validateClassId(material[1]), validateMaterialId(material[2]), identity.uid);
        return emptyResponse(204, requestId);
      }
      if (progress && method === 'PUT') {
        const input = validateProgress(parseBody(event));
        const result = await repository.setProgress({ classId: validateClassId(progress[1]), materialId: validateMaterialId(progress[2]), uid: identity.uid, ...input });
        return jsonResponse(200, { data: { progress: result } }, requestId);
      }
      if (bookmark && ['PUT', 'DELETE'].includes(method)) {
        const result = await repository.setBookmark({ classId: validateClassId(bookmark[1]), materialId: validateMaterialId(bookmark[2]), uid: identity.uid, saved: method === 'PUT' });
        return jsonResponse(200, { data: result }, requestId);
      }
      if (savedList && method === 'GET') {
        const materials = await repository.listUserState(identity.uid, 'bookmarks');
        return jsonResponse(200, { data: { materials } }, requestId);
      }
      if (progressList && method === 'GET') {
        const materials = await repository.listUserState(identity.uid, 'progress');
        return jsonResponse(200, { data: { materials } }, requestId);
      }
      return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
    } catch (caught) {
      const error = normalizedError(caught);
      logger.error(JSON.stringify({ requestId, function: 'materials', operation, status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
