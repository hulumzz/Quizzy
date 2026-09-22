import { apiRequest } from './api';

const base = (classId) => `/classes/${encodeURIComponent(classId)}/attendance`;

export async function listAttendance(classId, { signal } = {}) {
  const data = await apiRequest(base(classId), { signal });
  return data?.attendance || [];
}

export async function getAttendanceSession(classId, attendanceId, { signal } = {}) {
  const data = await apiRequest(`${base(classId)}/${encodeURIComponent(attendanceId)}`, { signal });
  return data.attendance;
}

export async function createAttendanceSession(classId, input) {
  const data = await apiRequest(base(classId), { method: 'POST', body: input });
  return data.attendance;
}

export async function setAttendanceStatus(classId, attendanceId, status) {
  const data = await apiRequest(`${base(classId)}/${encodeURIComponent(attendanceId)}/status`, { method: 'PUT', body: { status } });
  return data.attendance;
}

export async function checkInAttendance(classId, attendanceId, location) {
  const data = await apiRequest(`${base(classId)}/${encodeURIComponent(attendanceId)}/check-in`, { method: 'POST', body: location });
  return data.checkIn;
}

export function attendanceErrorMessage(error) {
  if (error?.code === 'API_NOT_CONFIGURED') return 'Layanan presensi belum tersedia di lingkungan ini.';
  if (error?.status === 401 || error?.code === 'AUTH_REQUIRED') return 'Sesi masuk berakhir. Silakan masuk kembali.';
  if (error?.status === 403) return error.message || 'Akun ini tidak memiliki akses ke presensi tersebut.';
  if (error?.status === 404) return error.message || 'Sesi presensi tidak ditemukan.';
  if (error?.code === 'OUTSIDE_RADIUS') {
    const distance = Number(error.details?.distanceMeters);
    const radius = Number(error.details?.radiusMeters);
    if (Number.isFinite(distance) && Number.isFinite(radius)) return `Lokasi masih sekitar ${distance} m dari titik presensi. Radius yang diizinkan ${radius} m.`;
    return 'Lokasi berada di luar radius presensi.';
  }
  if (error?.status === 409) return error.message || 'Status sesi presensi sudah berubah. Muat ulang lalu coba lagi.';
  if (error?.code === 'NETWORK_ERROR') return 'Koneksi ke layanan presensi gagal. Periksa jaringan lalu coba lagi.';
  return error?.message || 'Presensi belum dapat diproses. Coba lagi beberapa saat.';
}
