import { apiRequest } from './api';

const base = (classId) => `/classes/${encodeURIComponent(classId)}/quizzes`;
export async function listQuizzes(classId, options = {}) { const data = await apiRequest(base(classId), options); return data?.quizzes || []; }
export async function getQuiz(classId, quizId, options = {}) { const data = await apiRequest(`${base(classId)}/${encodeURIComponent(quizId)}`, options); return data.quiz; }
export async function createQuiz(classId, input) { const data = await apiRequest(base(classId), { method: 'POST', body: input }); return data.quiz; }
export async function updateQuiz(classId, quizId, input) { const data = await apiRequest(`${base(classId)}/${encodeURIComponent(quizId)}`, { method: 'PUT', body: input }); return data.quiz; }
export async function deleteQuiz(classId, quizId) { await apiRequest(`${base(classId)}/${encodeURIComponent(quizId)}`, { method: 'DELETE' }); }
export async function submitQuiz(classId, quizId, answers) { const data = await apiRequest(`${base(classId)}/${encodeURIComponent(quizId)}/attempts`, { method: 'POST', body: { answers } }); return data.result; }
export async function getQuizResults(classId, quizId, options = {}) { const data = await apiRequest(`${base(classId)}/${encodeURIComponent(quizId)}/results`, options); return data.results; }
export function quizErrorMessage(error) {
  if (error?.code === 'QUIZ_ALREADY_SUBMITTED') return 'Kuis ini sudah pernah kamu kumpulkan.';
  if (error?.status === 404) return 'Kuis tidak ditemukan atau belum diterbitkan.';
  if (error?.status === 403) return error.message || 'Akun ini tidak memiliki akses ke kuis.';
  if (error?.code === 'NETWORK_ERROR') return 'Koneksi ke layanan kuis gagal. Coba lagi.';
  return error?.message || 'Kuis belum dapat diproses.';
}
