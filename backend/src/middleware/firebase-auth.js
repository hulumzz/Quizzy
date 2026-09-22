import { decodeProtectedHeader, importX509, jwtVerify } from 'jose';
import { HttpError, unauthorized } from '../http/errors.js';

const CERTIFICATES_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificateCache = { expiresAt: 0, certificates: {} };

function headerValue(headers = {}, name) {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

export function readBearerToken(event) {
  const authorization = headerValue(event?.headers, 'authorization');
  if (!authorization) throw unauthorized('Silakan masuk untuk melanjutkan.');
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match || match[1].length > 8192) throw unauthorized();
  return match[1];
}

function cacheLifetime(headers) {
  const cacheControl = headers.get('cache-control') || '';
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 300);
  return Math.max(60, Math.min(maxAge, 3600)) * 1000;
}

async function getCertificates(fetchImpl, now) {
  if (certificateCache.expiresAt > now && Object.keys(certificateCache.certificates).length) {
    return certificateCache.certificates;
  }

  let response;
  try {
    response = await fetchImpl(CERTIFICATES_URL, { signal: AbortSignal.timeout(3500) });
  } catch {
    throw new HttpError(503, 'AUTH_KEYS_UNAVAILABLE', 'Layanan autentikasi sedang tidak tersedia.');
  }
  if (!response.ok) throw new HttpError(503, 'AUTH_KEYS_UNAVAILABLE', 'Layanan autentikasi sedang tidak tersedia.');

  const certificates = await response.json();
  certificateCache = { certificates, expiresAt: now + cacheLifetime(response.headers) };
  return certificates;
}

export async function verifyFirebaseToken(token, { projectId = process.env.FIREBASE_PROJECT_ID, fetchImpl = fetch, now = Date.now() } = {}) {
  if (!projectId) throw new HttpError(500, 'SERVER_CONFIGURATION_ERROR', 'Konfigurasi autentikasi server belum lengkap.');

  let protectedHeader;
  try {
    protectedHeader = decodeProtectedHeader(token);
  } catch {
    throw unauthorized();
  }
  if (protectedHeader.alg !== 'RS256' || !protectedHeader.kid) throw unauthorized();

  const certificates = await getCertificates(fetchImpl, now);
  const certificate = certificates[protectedHeader.kid];
  if (!certificate) throw unauthorized();

  try {
    const key = await importX509(certificate, 'RS256');
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    });
    const nowSeconds = Math.floor(now / 1000);
    if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) throw unauthorized();
    if (typeof payload.iat !== 'number' || payload.iat > nowSeconds) throw unauthorized();
    if (typeof payload.auth_time !== 'number' || payload.auth_time > nowSeconds) throw unauthorized();

    return {
      uid: payload.sub,
      name: typeof payload.name === 'string' ? payload.name : '',
      email: typeof payload.email === 'string' ? payload.email : '',
      signInProvider: payload.firebase?.sign_in_provider || '',
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw unauthorized();
  }
}

export async function authenticateRequest(event) {
  return verifyFirebaseToken(readBearerToken(event));
}
