import { json } from '../http/response.js';

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
}

export async function exactCors(c, next) {
  const origin = c.req.header('origin');
  const allowed = Boolean(origin && allowedOrigins(c.env).includes(origin));
  if (c.req.method === 'OPTIONS') {
    if (!allowed) return json(c, 403, { error: { code: 'ORIGIN_FORBIDDEN', message: 'Origin tidak diizinkan.' } });
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type, x-idempotency-key',
      'access-control-max-age': '86400',
      vary: 'Origin',
    } });
  }
  await next();
  if (allowed) {
    c.header('access-control-allow-origin', origin);
    c.header('vary', 'Origin');
  }
  c.header('cache-control', 'no-store');
}
