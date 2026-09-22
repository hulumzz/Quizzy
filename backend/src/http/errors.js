export class HttpError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) => new HttpError(400, code, message, details);
export const unauthorized = (message = 'Token autentikasi tidak valid.') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Akun tidak memiliki akses untuk operasi ini.') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Data yang diminta tidak ditemukan.') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (code, message) => new HttpError(409, code, message);
