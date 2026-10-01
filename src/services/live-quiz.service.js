import { appEnv } from '../config/env';
import { connectLiveSocket } from '../features/quiz/live-connection';
import { apiDownload, apiRequest, optionalAuthApiRequest, publicApiRequest } from './api';

const codePath = (code) => `/live-quizzes/${encodeURIComponent(code.trim().toUpperCase())}`;
const hostPath = (classId, sessionId) => `/classes/${encodeURIComponent(classId)}/live-sessions/${encodeURIComponent(sessionId)}`;
const generalHostPath = (sessionId) => `/general-quizzes/live-sessions/${encodeURIComponent(sessionId)}`;

export async function createLiveSession(classId, quizId, input = {}) { const data = await apiRequest(`/classes/${encodeURIComponent(classId)}/quizzes/${encodeURIComponent(quizId)}/live-sessions`, { method: 'POST', body: input }); return data.session; }
export async function getLiveHostSession(classId, sessionId, options = {}) { const data = await apiRequest(hostPath(classId, sessionId), options); return data.session; }
export async function advanceLiveSession(classId, sessionId, action = 'advance', expected = {}) { const data = await apiRequest(`${hostPath(classId, sessionId)}/action`, { method: 'POST', body: { action, ...expected } }); return data.session; }
export async function createLiveHostSocketTicket(classId, sessionId) { const data = await apiRequest(`${hostPath(classId, sessionId)}/socket-ticket`, { method: 'POST', body: {} }); return data.socket; }
export async function retryLivePersistence(classId, sessionId) { const data = await apiRequest(`${hostPath(classId, sessionId)}/persist`, { method: 'POST', body: {} }); return data.session; }

export async function createGeneralLiveSession(quizId, input = {}) { const data = await apiRequest(`/general-quizzes/${encodeURIComponent(quizId)}/live-sessions`, { method: 'POST', body: input }); return data.session; }
export async function getGeneralLiveHostSession(sessionId, options = {}) { const data = await apiRequest(generalHostPath(sessionId), options); return data.session; }
export async function advanceGeneralLiveSession(sessionId, action = 'advance', expected = {}) { const data = await apiRequest(`${generalHostPath(sessionId)}/action`, { method: 'POST', body: { action, ...expected } }); return data.session; }
export async function createGeneralLiveHostSocketTicket(sessionId) { const data = await apiRequest(`${generalHostPath(sessionId)}/socket-ticket`, { method: 'POST', body: {} }); return data.socket; }
export async function retryGeneralLivePersistence(sessionId) { const data = await apiRequest(`${generalHostPath(sessionId)}/persist`, { method: 'POST', body: {} }); return data.session; }

export async function getLiveSession(code, options = {}) { const data = await publicApiRequest(codePath(code), options); return data.session; }
export async function getLiveParticipantState(code, participant) { const data = await publicApiRequest(`${codePath(code)}/state`, { method: 'POST', body: participant }); return data.session; }
export async function joinLiveSession(code, name) { return optionalAuthApiRequest(`${codePath(code)}/join`, { method: 'POST', body: { name } }); }
export async function answerLiveQuestion(code, payload) { const data = await publicApiRequest(`${codePath(code)}/answer`, { method: 'POST', body: payload }); return data.receipt; }
export async function getLiveParticipantResult(code, participant) { const data = await publicApiRequest(`${codePath(code)}/result`, { method: 'POST', body: participant }); return data.result; }

export async function listClassLiveResults(classId, options = {}) {
  const data = await apiRequest(`/classes/${encodeURIComponent(classId)}/live-results`, options);
  return data.sessions || [];
}
export async function getClassLiveResult(classId, sessionId, options = {}) {
  const data = await apiRequest(`/classes/${encodeURIComponent(classId)}/live-results/${encodeURIComponent(sessionId)}`, options);
  return data.result;
}
export async function downloadClassLiveResult(classId, sessionId) {
  return apiDownload(`/classes/${encodeURIComponent(classId)}/live-results/${encodeURIComponent(sessionId)}/export`);
}
export async function listGeneralLiveResults(options = {}) {
  const data = await apiRequest('/general-quizzes/live-results', options);
  return data.sessions || [];
}
export async function getGeneralLiveResult(sessionId, options = {}) {
  const data = await apiRequest(`/general-quizzes/live-results/${encodeURIComponent(sessionId)}`, options);
  return data.result;
}
export async function downloadGeneralLiveResult(sessionId) {
  return apiDownload(`/general-quizzes/live-results/${encodeURIComponent(sessionId)}/export`);
}

function socketUrl(code) {
  const root = new URL(appEnv.apiUrl || '/', window.location.origin);
  const basePath = root.pathname.replace(/\/$/, '');
  root.pathname = `${basePath}/live-quizzes/${encodeURIComponent(code.trim().toUpperCase())}/socket`;
  root.search = '';
  root.hash = '';
  root.protocol = root.protocol === 'https:' ? 'wss:' : 'ws:';
  return root.toString();
}

export function openLiveSocket(code, options = {}) {
  return connectLiveSocket(socketUrl(code), options);
}

export function liveQuizErrorMessage(error) {
  const messages = {
    LIVE_JOIN_CLOSED: 'Sesi sudah dimulai atau telah berakhir.',
    LIVE_QUESTION_LOCKED: 'Waktu untuk menjawab sudah habis.',
    LIVE_QUESTION_CHANGED: 'Soal sudah berganti. Tunggu tampilan diperbarui.',
    LIVE_ANSWER_ALREADY_RECEIVED: 'Jawaban untuk soal ini sudah diterima.',
    LIVE_QUESTION_NOT_OPEN: 'Belum ada soal yang dapat dijawab.',
    LIVE_RESULT_NOT_READY: 'Hasil sedang disiapkan oleh host.',
    LIVE_STUDENT_ALREADY_JOINED: 'Akun siswa ini sudah terhubung ke sesi.',
    API_NOT_CONFIGURED: 'Layanan kuis belum dikonfigurasi.',
  };
  return messages[error?.code] || error?.message || 'Kuis belum dapat diproses.';
}
