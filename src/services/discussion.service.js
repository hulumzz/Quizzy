import { apiRequest } from './api';

const base = (classId, materialId) => `/classes/${encodeURIComponent(classId)}/materials/${encodeURIComponent(materialId)}/discussions`;

export async function listDiscussions(classId, materialId, { signal } = {}) {
  return apiRequest(base(classId, materialId), { signal });
}

export async function createDiscussion(classId, materialId, content) {
  const data = await apiRequest(base(classId, materialId), { method: 'POST', body: { content } });
  return data.discussion;
}

export async function createReply(classId, materialId, discussionId, content) {
  const data = await apiRequest(`${base(classId, materialId)}/${encodeURIComponent(discussionId)}/replies`, { method: 'POST', body: { content } });
  return data.reply;
}

export async function updateDiscussionMessage(classId, materialId, discussionId, { replyId, content }) {
  const replyPath = replyId ? `/replies/${encodeURIComponent(replyId)}` : '';
  const data = await apiRequest(`${base(classId, materialId)}/${encodeURIComponent(discussionId)}${replyPath}`, { method: 'PUT', body: { content } });
  return data.message;
}

export async function deleteDiscussionMessage(classId, materialId, discussionId, replyId) {
  const replyPath = replyId ? `/replies/${encodeURIComponent(replyId)}` : '';
  await apiRequest(`${base(classId, materialId)}/${encodeURIComponent(discussionId)}${replyPath}`, { method: 'DELETE' });
}

export async function setDiscussionStatus(classId, materialId, discussionId, status, answerId = null) {
  const data = await apiRequest(`${base(classId, materialId)}/${encodeURIComponent(discussionId)}/status`, { method: 'PUT', body: { status, answerId } });
  return data.discussion;
}

export function discussionErrorMessage(error) {
  if (error?.code === 'API_NOT_CONFIGURED') return 'Layanan diskusi belum tersedia di lingkungan ini.';
  if (error?.status === 401 || error?.code === 'AUTH_REQUIRED') return 'Sesi masuk berakhir. Silakan masuk kembali.';
  if (error?.status === 403) return error.message || 'Akun ini tidak memiliki akses ke diskusi tersebut.';
  if (error?.status === 404) return error.message || 'Diskusi atau materi tidak ditemukan.';
  if (error?.code === 'NETWORK_ERROR') return 'Koneksi ke layanan diskusi gagal. Periksa jaringan lalu coba lagi.';
  return error?.message || 'Diskusi belum dapat diproses. Coba lagi beberapa saat.';
}
