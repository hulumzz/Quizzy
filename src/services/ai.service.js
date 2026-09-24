import { appEnv } from '../config/env';
import { getAuthToken } from './auth-token';
import { ApiError } from './api';

export async function askQuizzyAi({ task, context, instruction = '', signal } = {}) {
  if (!appEnv.aiUrl) throw new ApiError('Asisten AI belum dikonfigurasi.', { code: 'AI_NOT_CONFIGURED' });
  // AI uses a separately verified Firebase token. Refresh once per request so a
  // stale cached token cannot be rejected by the Worker after a long editor session.
  const token = await getAuthToken({ forceRefresh: true });
  let response;
  try { response = await fetch(`${appEnv.aiUrl}/api/ai/assist`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ task, context, instruction }), signal }); } catch (error) { if (error.name === 'AbortError') throw error; throw new ApiError('Tidak dapat terhubung ke asisten AI.', { code: 'AI_NETWORK_ERROR' }); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error?.message || 'Asisten AI belum dapat memproses permintaan.', { code: payload.error?.code || 'AI_ERROR', status: response.status });
  return payload.data;
}
