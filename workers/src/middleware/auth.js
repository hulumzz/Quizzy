import { forbidden } from '../http/errors.js';
import { verifyFirebaseToken } from '../services/firebase-auth.js';
import { resolveAccountRole } from '../services/account-role.js';

export async function requireAuth(c, next) {
  const authorization = c.req.header('authorization');
  const identity = await verifyFirebaseToken(authorization, c.env.FIREBASE_PROJECT_ID);
  c.set('auth', identity);
  c.set('authToken', authorization);
  await next();
}

export async function optionalAuth(c, next) {
  const authorization = c.req.header('authorization');
  if (!authorization) {
    c.set('auth', null);
    c.set('authToken', null);
    await next();
    return;
  }
  const identity = await verifyFirebaseToken(authorization, c.env.FIREBASE_PROJECT_ID);
  c.set('auth', identity);
  c.set('authToken', authorization);
  await next();
}

export const getAuth = (c) => c.get('auth');

export async function getAccountRole(c) {
  const cached = c.get('accountRole');
  if (cached) return cached;
  const identity = getAuth(c);
  const role = await resolveAccountRole({
    db: c.env.DB,
    identity,
    authorization: c.get('authToken'),
    projectId: c.env.FIREBASE_PROJECT_ID,
  });
  c.set('accountRole', role);
  return role;
}

export async function assertAccountRole(c, ...allowed) {
  const role = await getAccountRole(c);
  if (!allowed.includes(role)) {
    const label = allowed.includes('teacher') && !allowed.includes('student') ? 'guru' : allowed.includes('student') && !allowed.includes('teacher') ? 'siswa' : 'akun yang sesuai';
    throw forbidden(`Fitur ini hanya tersedia untuk ${label}.`);
  }
  return role;
}
