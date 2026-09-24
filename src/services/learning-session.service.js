import { apiRequest } from './api';

const base = (classId) => `/classes/${encodeURIComponent(classId)}/sessions`;

export async function listLearningSessions(classId, { signal } = {}) {
  const data = await apiRequest(base(classId), { signal });
  return data?.sessions || [];
}

export async function getLearningSession(classId, sessionId, { signal } = {}) {
  const data = await apiRequest(`${base(classId)}/${encodeURIComponent(sessionId)}`, { signal });
  return data.session;
}

export async function createLearningSession(classId, input) {
  const data = await apiRequest(base(classId), { method: 'POST', body: input });
  return data.session;
}

export async function updateLearningSession(classId, sessionId, input) {
  const data = await apiRequest(`${base(classId)}/${encodeURIComponent(sessionId)}`, { method: 'PUT', body: input });
  return data.session;
}

export async function reorderLearningSessions(classId, sessionIds) {
  const data = await apiRequest(`${base(classId)}/reorder`, { method: 'PUT', body: { sessionIds } });
  return data?.sessions || [];
}

export function learningSessionErrorMessage(error) {
  if (error?.code === 'API_NOT_CONFIGURED') return 'Layanan pertemuan belum tersedia di lingkungan ini.';
  if (error?.status === 401 || error?.code === 'AUTH_REQUIRED') return 'Sesi masuk berakhir. Silakan masuk kembali.';
  if (error?.status === 403) return error.message || 'Akun ini tidak memiliki akses untuk mengatur pertemuan.';
  if (error?.status === 404) return 'Pertemuan tidak ditemukan.';
  if (error?.status === 409) return error.message || 'Data pertemuan baru saja berubah. Muat ulang lalu coba lagi.';
  if (error?.code === 'NETWORK_ERROR') return 'Koneksi ke layanan pertemuan gagal. Periksa jaringan lalu coba lagi.';
  return error?.message || 'Pertemuan belum dapat diproses.';
}
