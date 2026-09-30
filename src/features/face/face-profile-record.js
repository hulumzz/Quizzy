export const FACE_PROFILE_SCHEMA_VERSION = 1;
export const FACE_PROFILE_MODEL_VERSION = 'human-v1';
export const FACE_PROFILE_CONSENT_VERSION = '2026-09';

function timestampToIso(value) {
  if (typeof value === 'string') return value;
  if (value?.toDate) return value.toDate().toISOString();
  return null;
}

export function normalizeFaceProfileInput(input) {
  if (!input || input.consent !== true) throw Object.assign(new Error('Persetujuan penggunaan profil wajah wajib diberikan.'), { code: 'FACE_PROFILE_CONSENT_REQUIRED' });
  if (input.modelVersion !== FACE_PROFILE_MODEL_VERSION) throw Object.assign(new Error('Versi model profil wajah tidak didukung.'), { code: 'FACE_PROFILE_MODEL_UNSUPPORTED' });
  if (!Array.isArray(input.embedding) || input.embedding.length < 64 || input.embedding.length > 2048 || input.embedding.some((value) => !Number.isFinite(value) || Math.abs(value) > 100)) {
    throw Object.assign(new Error('Embedding wajah tidak valid. Silakan daftar ulang.'), { code: 'FACE_PROFILE_INVALID' });
  }
  return { schemaVersion: FACE_PROFILE_SCHEMA_VERSION, modelVersion: FACE_PROFILE_MODEL_VERSION, embedding: input.embedding.map((value) => Number(value.toFixed(8))), status: 'active', consentVersion: FACE_PROFILE_CONSENT_VERSION };
}

export function toFaceProfile(data) {
  if (!data || data.schemaVersion !== FACE_PROFILE_SCHEMA_VERSION || data.modelVersion !== FACE_PROFILE_MODEL_VERSION || data.status !== 'active' || !Array.isArray(data.embedding)) return null;
  return { schemaVersion: data.schemaVersion, modelVersion: data.modelVersion, embedding: data.embedding, status: data.status, consentVersion: data.consentVersion || null, enrolledAt: timestampToIso(data.enrolledAt), updatedAt: timestampToIso(data.updatedAt) };
}
