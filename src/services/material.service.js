import { apiRequest } from './api';

const base = (classId) => `/classes/${encodeURIComponent(classId)}/materials`;

export async function listMaterials(classId, { signal } = {}) {
  const data = await apiRequest(base(classId), { signal });
  return data?.materials || [];
}

export async function getMaterial(classId, materialId, { signal } = {}) {
  const data = await apiRequest(`${base(classId)}/${encodeURIComponent(materialId)}`, { signal });
  return data.material;
}

export async function createMaterial(classId, input) {
  const data = await apiRequest(base(classId), { method: 'POST', body: input });
  return data.material;
}

export async function updateMaterial(classId, materialId, input) {
  const data = await apiRequest(`${base(classId)}/${encodeURIComponent(materialId)}`, { method: 'PUT', body: input });
  return data.material;
}

export async function deleteMaterial(classId, materialId) {
  await apiRequest(`${base(classId)}/${encodeURIComponent(materialId)}`, { method: 'DELETE' });
}

export async function saveProgress(classId, materialId, percent) {
  const data = await apiRequest(`${base(classId)}/${encodeURIComponent(materialId)}/progress`, { method: 'PUT', body: { percent } });
  return data.progress;
}

export async function setMaterialBookmark(classId, materialId, bookmarked) {
  const data = await apiRequest(`${base(classId)}/${encodeURIComponent(materialId)}/bookmark`, { method: bookmarked ? 'PUT' : 'DELETE' });
  return data.bookmarked;
}

export async function listSavedMaterials({ signal } = {}) {
  const data = await apiRequest('/learning/bookmarks', { signal });
  return data?.materials || [];
}

export async function listProgressMaterials({ signal } = {}) {
  const data = await apiRequest('/learning/progress', { signal });
  return data?.materials || [];
}

export function materialErrorMessage(error) {
  if (error?.code === 'API_NOT_CONFIGURED') return 'Layanan materi belum tersedia di lingkungan ini.';
  if (error?.status === 401 || error?.code === 'AUTH_REQUIRED') return 'Sesi masuk berakhir. Silakan masuk kembali.';
  if (error?.status === 403) return error.message || 'Akun ini tidak memiliki akses ke materi tersebut.';
  if (error?.status === 404) return 'Materi tidak ditemukan atau belum dipublikasikan.';
  if (error?.code === 'NETWORK_ERROR') return 'Koneksi ke layanan materi gagal. Periksa jaringan lalu coba lagi.';
  return error?.message || 'Materi belum dapat diproses. Coba lagi beberapa saat.';
}
