import { apiRequest } from './api';

export async function listClasses({ scope = 'owned', signal } = {}) {
  const data = await apiRequest(`/classes?scope=${encodeURIComponent(scope)}`, { signal });
  return data?.classes || [];
}

export async function createClass(input) {
  const data = await apiRequest('/classes', { method: 'POST', body: input });
  return data.class;
}

export async function joinClass(code) {
  const idempotencyKey = crypto.randomUUID();
  const data = await apiRequest('/classes/join', {
    method: 'POST',
    body: { code },
    headers: { 'x-idempotency-key': idempotencyKey },
  });
  return data.class;
}

export async function getClass(classId, { signal } = {}) {
  const data = await apiRequest(`/classes/${encodeURIComponent(classId)}`, { signal });
  return data.class;
}

export async function listClassMembers(classId, { signal } = {}) {
  const data = await apiRequest(`/classes/${encodeURIComponent(classId)}/members`, { signal });
  return data?.members || [];
}

export function classErrorMessage(error) {
  if (error?.code === 'API_NOT_CONFIGURED') return 'Layanan kelas belum tersedia di lingkungan ini.';
  if (error?.status === 401 || error?.code === 'AUTH_REQUIRED') return 'Sesi masuk berakhir. Silakan masuk kembali.';
  if (error?.status === 403) return error.message || 'Akun ini tidak memiliki akses ke kelas tersebut.';
  if (error?.status === 404) return 'Kelas tidak ditemukan. Periksa kembali kode atau tautannya.';
  if (error?.status === 409) return error.message || 'Permintaan kelas bertabrakan. Silakan coba lagi.';
  if (error?.code === 'NETWORK_ERROR') return 'Koneksi ke layanan kelas gagal. Periksa jaringan lalu coba lagi.';
  return error?.message || 'Kelas belum dapat dimuat. Coba lagi beberapa saat.';
}
