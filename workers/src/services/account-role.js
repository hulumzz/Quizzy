import { forbidden, HttpError } from '../http/errors.js';

const VALID_ROLES = new Set(['teacher', 'student']);
const ROLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function firestoreValue(field) {
  if (!field || typeof field !== 'object') return undefined;
  if ('stringValue' in field) return field.stringValue;
  if ('booleanValue' in field) return field.booleanValue;
  return undefined;
}

export async function fetchTrustedProfile({ authorization, projectId, uid, fetchImpl = fetch }) {
  if (!authorization || !projectId || !uid) throw forbidden('Profil akun belum dapat diverifikasi.');
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
  let response;
  try {
    response = await fetchImpl(endpoint, { headers: { authorization } });
  } catch {
    throw new HttpError(503, 'PROFILE_VERIFICATION_UNAVAILABLE', 'Verifikasi profil akun sedang tidak tersedia.');
  }
  if (response.status === 404) throw forbidden('Selesaikan profil akun sebelum menggunakan fitur ini.');
  if (response.status === 401 || response.status === 403) throw forbidden('Profil akun belum dapat diverifikasi.');
  if (!response.ok) throw new HttpError(503, 'PROFILE_VERIFICATION_UNAVAILABLE', 'Verifikasi profil akun sedang tidak tersedia.');

  const payload = await response.json();
  const role = firestoreValue(payload?.fields?.role);
  const profileUid = firestoreValue(payload?.fields?.uid);
  if (profileUid !== uid || !VALID_ROLES.has(role)) throw forbidden('Peran akun belum valid.');
  return {
    uid,
    role,
    name: firestoreValue(payload?.fields?.name) || '',
    email: firestoreValue(payload?.fields?.email) || '',
  };
}

export async function resolveAccountRole({ db, identity, authorization, projectId, fetchImpl = fetch, now = new Date().toISOString() }) {
  if (!identity?.uid) throw forbidden('Identitas akun tidak valid.');
  if (identity.signInProvider === 'anonymous') return 'student';

  const cached = await db.prepare('SELECT role, role_verified, role_verified_at FROM users WHERE id=?1').bind(identity.uid).first();
  const verifiedAt = Date.parse(cached?.role_verified_at || '');
  const nowMs = Date.parse(now);
  if (cached?.role_verified === 1 && VALID_ROLES.has(cached.role) && Number.isFinite(verifiedAt) && Number.isFinite(nowMs) && nowMs - verifiedAt < ROLE_CACHE_TTL_MS) return cached.role;

  const profile = await fetchTrustedProfile({ authorization, projectId, uid: identity.uid, fetchImpl });
  await db.prepare(`INSERT INTO users(id,email,name,role,created_at,updated_at,role_verified,role_verified_at)
    VALUES(?1,?2,?3,?4,?5,?5,1,?5)
    ON CONFLICT(id) DO UPDATE SET
      email=CASE WHEN excluded.email<>'' THEN excluded.email ELSE users.email END,
      name=CASE WHEN excluded.name<>'' THEN excluded.name ELSE users.name END,
      role=excluded.role,
      role_verified=1,
      role_verified_at=excluded.role_verified_at,
      updated_at=excluded.updated_at`)
    .bind(identity.uid, profile.email || identity.email || '', profile.name || identity.name || '', profile.role, now)
    .run();
  return profile.role;
}
