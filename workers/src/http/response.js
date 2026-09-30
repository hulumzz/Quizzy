import { HttpError } from './errors.js';

function requestId(c) {
  const existing = c.get('requestId');
  if (existing) return existing;
  const generated = crypto.randomUUID();
  c.set('requestId', generated);
  return generated;
}

export function json(c, status, payload, headers = {}) {
  return c.json(payload, status, {
    'cache-control': 'no-store',
    'x-request-id': requestId(c),
    ...headers,
  });
}

export function errorResponse(c, error) {
  const normalized = error instanceof HttpError ? error : new HttpError(500, 'INTERNAL_ERROR', 'Terjadi gangguan pada layanan.');
  if (!(error instanceof HttpError)) console.error('Unhandled API error', { requestId: requestId(c), name: error?.name, message: error?.message });
  return json(c, normalized.status, { error: { code: normalized.code, message: normalized.message, ...(normalized.details ? { details: normalized.details } : {}) } });
}
