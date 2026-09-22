import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, HttpError } from '../../http/errors.js';
import { emptyResponse, jsonResponse } from '../../http/response.js';
import { validateClassId } from '../../validation/class.js';
import { validateDiscussionId, validateDiscussionInput, validateDiscussionStatus } from '../../validation/discussion.js';
import { validateMaterialId } from '../../validation/material.js';

function methodOf(event) {
  return (event?.requestContext?.http?.method || event?.httpMethod || 'GET').toUpperCase();
}

function pathOf(event) {
  return (event?.rawPath || event?.path || '/').replace(/\/+$/, '') || '/';
}

function parseBody(event) {
  if (!event?.body) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (event.body.length > 24576) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Pesan diskusi terlalu besar.');
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    return JSON.parse(raw);
  } catch {
    throw badRequest('INVALID_JSON', 'Format data tidak valid.');
  }
}

function normalizedError(error) {
  return error instanceof HttpError ? error : new HttpError(500, 'INTERNAL_ERROR', 'Terjadi kendala pada layanan Quizzy.');
}

function authorName(identity) {
  const emailName = identity.email?.split('@')[0]?.replace(/[._-]+/g, ' ');
  return (identity.name || emailName || 'Pengguna Quizzy').trim().slice(0, 80);
}

export function createDiscussionsHandler({ authenticate, repository, logger = console }) {
  return async function discussionsHandler(event, context = {}) {
    const method = methodOf(event);
    const path = pathOf(event);
    const requestId = context.awsRequestId || event?.requestContext?.requestId || randomUUID();
    const startedAt = Date.now();
    const collection = path.match(/^\/classes\/([^/]+)\/materials\/([^/]+)\/discussions$/);
    const statusRoute = path.match(/^\/classes\/([^/]+)\/materials\/([^/]+)\/discussions\/([^/]+)\/status$/);
    const replyItem = path.match(/^\/classes\/([^/]+)\/materials\/([^/]+)\/discussions\/([^/]+)\/replies\/([^/]+)$/);
    const replies = path.match(/^\/classes\/([^/]+)\/materials\/([^/]+)\/discussions\/([^/]+)\/replies$/);
    const item = path.match(/^\/classes\/([^/]+)\/materials\/([^/]+)\/discussions\/([^/]+)$/);

    try {
      if (method === 'OPTIONS') return emptyResponse(204, requestId);
      if (!collection && !statusRoute && !replyItem && !replies && !item) {
        return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } }, requestId);
      }
      const identity = await authenticate(event);
      if (identity.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan ruang diskusi.');

      const route = collection || statusRoute || replyItem || replies || item;
      const classId = validateClassId(route[1]);
      const materialId = validateMaterialId(route[2]);
      if (collection && method === 'GET') {
        const data = await repository.list(classId, materialId, identity.uid);
        return jsonResponse(200, { data }, requestId);
      }
      if (collection && method === 'POST') {
        const input = validateDiscussionInput(parseBody(event));
        const discussion = await repository.create({ classId, materialId, uid: identity.uid, authorName: authorName(identity), ...input });
        return jsonResponse(201, { data: { discussion } }, requestId);
      }
      if (replies && method === 'POST') {
        const input = validateDiscussionInput(parseBody(event));
        const reply = await repository.reply({ classId, materialId, discussionId: validateDiscussionId(replies[3]), uid: identity.uid, authorName: authorName(identity), ...input });
        return jsonResponse(201, { data: { reply } }, requestId);
      }
      if ((item || replyItem) && method === 'PUT') {
        const match = replyItem || item;
        const input = validateDiscussionInput(parseBody(event));
        const message = await repository.update({ classId, materialId, discussionId: validateDiscussionId(match[3]), ...(replyItem ? { replyId: validateDiscussionId(match[4], 'replyId') } : {}), uid: identity.uid, ...input });
        return jsonResponse(200, { data: { message } }, requestId);
      }
      if ((item || replyItem) && method === 'DELETE') {
        const match = replyItem || item;
        await repository.remove({ classId, materialId, discussionId: validateDiscussionId(match[3]), ...(replyItem ? { replyId: validateDiscussionId(match[4], 'replyId') } : {}), uid: identity.uid });
        return emptyResponse(204, requestId);
      }
      if (statusRoute && method === 'PUT') {
        const input = validateDiscussionStatus(parseBody(event));
        const discussion = await repository.setStatus({ classId, materialId, discussionId: validateDiscussionId(statusRoute[3]), uid: identity.uid, ...input });
        return jsonResponse(200, { data: { discussion } }, requestId);
      }
      return jsonResponse(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode tidak didukung.' } }, requestId);
    } catch (caught) {
      const error = normalizedError(caught);
      logger.error(JSON.stringify({ requestId, function: 'discussions', status: error.statusCode, duration: Date.now() - startedAt, errorCode: error.code }));
      return jsonResponse(error.statusCode, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, requestId);
    }
  };
}
