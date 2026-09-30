import { HttpError, unauthorized } from '../http/errors.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let signingKeys = { expiresAt: 0, values: new Map() };

const base64Url = (value) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), (character) => character.charCodeAt(0));
const jsonPart = (value) => JSON.parse(decoder.decode(base64Url(value)));
function cacheLifetime(headers) {
  const maxAge = Number((headers.get('cache-control') || '').match(/max-age=(\d+)/i)?.[1] || 3600);
  return Math.max(60, Math.min(maxAge, 6 * 60 * 60)) * 1000;
}

async function getSigningKeys({ forceRefresh = false } = {}) {
  if (!forceRefresh && signingKeys.expiresAt > Date.now()) return signingKeys.values;
  let response;
  try { response = await fetch(FIREBASE_JWKS_URL, forceRefresh ? { cache: 'no-store' } : { cf: { cacheTtl: 3600, cacheEverything: true } }); }
  catch { throw new HttpError(503, 'AUTH_KEYS_UNAVAILABLE', 'Layanan autentikasi sedang tidak tersedia.'); }
  if (!response.ok) throw new HttpError(503, 'AUTH_KEYS_UNAVAILABLE', 'Layanan autentikasi sedang tidak tersedia.');
  const payload = await response.json();
  const values = new Map();
  await Promise.all((Array.isArray(payload?.keys) ? payload.keys : []).filter((jwk) => jwk?.kid && jwk?.kty === 'RSA' && jwk?.alg === 'RS256').map(async (jwk) => values.set(jwk.kid, await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']))));
  if (!values.size) throw new HttpError(503, 'AUTH_KEYS_UNAVAILABLE', 'Layanan autentikasi sedang tidak tersedia.');
  signingKeys = { expiresAt: Date.now() + cacheLifetime(response.headers), values };
  return values;
}

export async function verifyFirebaseToken(authorization, projectId) {
  if (!projectId) throw new HttpError(500, 'SERVER_CONFIGURATION_ERROR', 'Konfigurasi autentikasi server belum lengkap.');
  const token = authorization?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (!token) throw unauthorized();
  const [encodedHeader, encodedPayload, encodedSignature, ...rest] = token.split('.');
  if (rest.length || !encodedHeader || !encodedPayload || !encodedSignature) throw unauthorized();
  let header; let payload;
  try { header = jsonPart(encodedHeader); payload = jsonPart(encodedPayload); } catch { throw unauthorized(); }
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || !header.kid || payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}` || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128 || !Number.isFinite(payload.exp) || payload.exp <= now || !Number.isFinite(payload.iat) || payload.iat > now || !Number.isFinite(payload.auth_time) || payload.auth_time > now) throw unauthorized();
  let key = (await getSigningKeys()).get(header.kid);
  if (!key) key = (await getSigningKeys({ forceRefresh: true })).get(header.kid);
  if (!key) throw unauthorized();
  try {
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64Url(encodedSignature), encoder.encode(`${encodedHeader}.${encodedPayload}`))) throw unauthorized();
  } catch (error) { if (error instanceof HttpError) throw error; throw unauthorized(); }
  return { uid: payload.sub, name: typeof payload.name === 'string' ? payload.name : '', email: typeof payload.email === 'string' ? payload.email : '', signInProvider: payload.firebase?.sign_in_provider || '' };
}
