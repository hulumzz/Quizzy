import { verifyFirebaseToken } from '../services/firebase-auth.js';

export async function requireAuth(c, next) {
  c.set('auth', await verifyFirebaseToken(c.req.header('authorization'), c.env.FIREBASE_PROJECT_ID));
  await next();
}

export const getAuth = (c) => c.get('auth');
