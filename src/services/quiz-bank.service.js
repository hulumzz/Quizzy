import { apiRequest } from './api';

export async function getQuizTaxonomy(options = {}) { const data = await apiRequest('/quiz-bank/taxonomy', options); return data; }
export async function listQuizBank({ level = 'all', subject = 'all', ...options } = {}) { const query = new URLSearchParams({ level, subject }); const data = await apiRequest(`/quiz-bank?${query}`, options); return data?.quizzes || []; }
export async function listMyBankQuizzes(options = {}) { const data = await apiRequest('/quiz-bank/mine', options); return data?.quizzes || []; }
export async function publishQuizToBank(input) { const data = await apiRequest('/quiz-bank/publish', { method: 'POST', body: input }); return data.quiz; }
export async function copyBankQuiz(catalogId, classId) { const data = await apiRequest(`/quiz-bank/${encodeURIComponent(catalogId)}/copy`, { method: 'POST', body: { classId } }); return data.quiz; }
export async function unpublishBankQuiz(catalogId) { await apiRequest(`/quiz-bank/${encodeURIComponent(catalogId)}`, { method: 'DELETE' }); }
