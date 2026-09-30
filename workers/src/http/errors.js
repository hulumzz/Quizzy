export class HttpError extends Error {
  constructor(status = 500, code = 'INTERNAL_ERROR', message = 'Terjadi gangguan pada layanan.', details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) => new HttpError(400, code, message, details);
export const unauthorized = (message = 'Silakan masuk untuk melanjutkan.') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Akun tidak memiliki akses untuk operasi ini.') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Data yang diminta tidak ditemukan.') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (code, message) => new HttpError(409, code, message);
