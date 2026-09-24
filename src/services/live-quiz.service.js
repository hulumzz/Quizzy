import { apiRequest, publicApiRequest } from './api';

const codePath = (code) => `/live-quizzes/${encodeURIComponent(code.trim().toUpperCase())}`;
const hostPath = (classId, sessionId) => `/classes/${encodeURIComponent(classId)}/live-sessions/${encodeURIComponent(sessionId)}`;
const generalHostPath = (sessionId) => `/general-quizzes/live-sessions/${encodeURIComponent(sessionId)}`;

export async function createLiveSession(classId, quizId, input = {}) { const data = await apiRequest(`/classes/${encodeURIComponent(classId)}/quizzes/${encodeURIComponent(quizId)}/live-sessions`, { method: 'POST', body: input }); return data.session; }
export async function getLiveHostSession(classId, sessionId, options = {}) { const data = await apiRequest(hostPath(classId, sessionId), options); return data.session; }
export async function advanceLiveSession(classId, sessionId, action = 'advance') { const data = await apiRequest(`${hostPath(classId, sessionId)}/action`, { method: 'POST', body: { action } }); return data.session; }
export async function createGeneralLiveSession(quizId, input = {}) { const data = await apiRequest(`/general-quizzes/${encodeURIComponent(quizId)}/live-sessions`, { method: 'POST', body: input }); return data.session; }
export async function getGeneralLiveHostSession(sessionId, options = {}) { const data = await apiRequest(generalHostPath(sessionId), options); return data.session; }
export async function advanceGeneralLiveSession(sessionId, action = 'advance') { const data = await apiRequest(`${generalHostPath(sessionId)}/action`, { method: 'POST', body: { action } }); return data.session; }
export async function getLiveSession(code, options = {}) { const data = await publicApiRequest(codePath(code), options); return data.session; }
export async function joinLiveSession(code, name) { return publicApiRequest(`${codePath(code)}/join`, { method: 'POST', body: { name } }); }
export async function answerLiveQuestion(code, payload) { const data = await publicApiRequest(`${codePath(code)}/answer`, { method: 'POST', body: payload }); return data.receipt; }
export async function getLiveParticipantResult(code, participant) { const data = await publicApiRequest(`${codePath(code)}/result`, { method: 'POST', body: participant }); return data.result; }
export function liveQuizErrorMessage(error) { const messages = { LIVE_JOIN_CLOSED: 'Sesi sudah dimulai atau telah berakhir.', LIVE_QUESTION_LOCKED: 'Waktu untuk menjawab sudah habis.', LIVE_QUESTION_CHANGED: 'Soal sudah berganti. Tunggu tampilan diperbarui.', LIVE_ANSWER_ALREADY_RECEIVED: 'Jawaban untuk soal ini sudah diterima.', LIVE_QUESTION_NOT_OPEN: 'Belum ada soal yang dapat dijawab.', LIVE_RESULT_NOT_READY: 'Hasil sedang disiapkan oleh host.', API_NOT_CONFIGURED: 'Layanan kuis belum dikonfigurasi.' }; return messages[error?.code] || error?.message || 'Kuis belum dapat diproses.'; }
