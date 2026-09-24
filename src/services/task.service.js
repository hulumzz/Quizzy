import { apiRequest } from './api';

const base = (classId) => `/classes/${encodeURIComponent(classId)}/tasks`;
export async function listTasks(classId, options = {}) { const data = await apiRequest(base(classId), options); return data.tasks || []; }
export async function getTask(classId, taskId, options = {}) { const data = await apiRequest(`${base(classId)}/${encodeURIComponent(taskId)}`, options); return data.task; }
export async function createTask(classId, input) { const data = await apiRequest(base(classId), { method: 'POST', body: input }); return data.task; }
export async function updateTask(classId, taskId, input) { const data = await apiRequest(`${base(classId)}/${encodeURIComponent(taskId)}`, { method: 'PUT', body: input }); return data.task; }
export async function submitTask(classId, taskId, input) { const data = await apiRequest(`${base(classId)}/${encodeURIComponent(taskId)}/submission`, { method: 'POST', body: input }); return data.submission; }
export async function listTaskSubmissions(classId, taskId) { const data = await apiRequest(`${base(classId)}/${encodeURIComponent(taskId)}/submissions`); return data.submissions || []; }
export async function gradeTaskSubmission(classId, taskId, studentId, input) { const data = await apiRequest(`${base(classId)}/${encodeURIComponent(taskId)}/submissions/${encodeURIComponent(studentId)}`, { method: 'PUT', body: input }); return data.submission; }
export function taskErrorMessage(error) {
  if (error?.code === 'TEXT_ANSWER_REQUIRED' || error?.code === 'ATTACHMENT_REQUIRED' || error?.code === 'BOTH_ANSWERS_REQUIRED' || error?.code === 'ATTACHMENT_NOT_ALLOWED') return error.message;
  if (error?.status === 403) return 'Kamu tidak memiliki akses untuk tindakan ini.';
  return error?.message || 'Tugas belum dapat diproses.';
}
