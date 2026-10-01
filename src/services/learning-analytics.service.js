import { apiRequest } from './api';

const base = (classId) => `/classes/${encodeURIComponent(classId)}/analytics`;

export async function getClassLearningAnalytics(classId, { signal } = {}) {
  const data = await apiRequest(base(classId), { signal });
  return data.analytics;
}

export async function getMyLearningAnalytics(classId, { signal } = {}) {
  const data = await apiRequest(`${base(classId)}/me`, { signal });
  return data.analytics;
}

export async function getStudentLearningAnalytics(classId, studentId, { signal } = {}) {
  const data = await apiRequest(`${base(classId)}/students/${encodeURIComponent(studentId)}`, { signal });
  return data.analytics;
}

export function learningAnalyticsErrorMessage(error) {
  if (error?.code === 'API_NOT_CONFIGURED') return 'Layanan Learning Insights belum tersedia di lingkungan ini.';
  if (error?.status === 401 || error?.code === 'AUTH_REQUIRED') return 'Sesi masuk berakhir. Silakan masuk kembali.';
  if (error?.status === 403) return error.message || 'Akun ini tidak memiliki akses ke analitik kelas.';
  if (error?.status === 404) return error.message || 'Data analitik belum ditemukan.';
  if (error?.code === 'NETWORK_ERROR') return 'Koneksi ke Learning Insights gagal. Periksa jaringan lalu coba lagi.';
  return error?.message || 'Learning Insights belum dapat dimuat.';
}
