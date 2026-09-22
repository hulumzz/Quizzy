import { appEnv } from '../config/env';
import { getAuthToken } from './auth-token';

export class ApiError extends Error {
  constructor(message, { code = 'API_ERROR', status = 0, details, requestId } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export async function apiRequest(path, { method = 'GET', body, signal, headers = {} } = {}) {
  if (!appEnv.apiUrl) {
    throw new ApiError('Layanan Quizzy belum dikonfigurasi.', { code: 'API_NOT_CONFIGURED' });
  }

  let token;
  try {
    token = await getAuthToken();
  } catch (error) {
    throw new ApiError('Sesi masuk tidak tersedia.', { code: error.code || 'AUTH_REQUIRED', status: 401 });
  }

  let response;
  try {
    response = await fetch(`${appEnv.apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Tidak dapat terhubung ke layanan Quizzy.', { code: 'NETWORK_ERROR' });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error?.message || 'Permintaan belum dapat diproses.', {
      code: payload.error?.code || 'API_ERROR',
      status: response.status,
      details: payload.error?.details,
      requestId: response.headers.get('x-request-id'),
    });
  }
  return payload.data;
}
