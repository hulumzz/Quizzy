import { badRequest, HttpError } from '../http/errors.js';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const FILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

export function validateUploadIntent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw badRequest('INVALID_BODY', 'Data unggahan tidak valid.');
  const fileName = typeof input.fileName === 'string' ? input.fileName.trim() : '';
  const mimeType = typeof input.mimeType === 'string' ? input.mimeType.trim().toLowerCase() : '';
  const size = Number(input.size);
  const isImage = IMAGE_TYPES.has(mimeType);
  const isPdf = mimeType === 'application/pdf';
  if (!fileName || fileName.length > 180 || /[\\/]/.test(fileName) || fileName.includes('\u0000')) throw badRequest('VALIDATION_ERROR', 'Nama file tidak valid.', { fileName: 'Nama file maksimal 180 karakter dan tidak boleh berisi path.' });
  if (!isImage && !FILE_TYPES.has(mimeType)) throw badRequest('UNSUPPORTED_FILE_TYPE', 'Jenis file belum didukung.');
  const maxBytes = isImage ? 8 * 1024 * 1024 : 15 * 1024 * 1024;
  if (!Number.isInteger(size) || size < 1 || size > maxBytes) throw new HttpError(413, 'FILE_TOO_LARGE', isImage ? 'Ukuran gambar maksimal 8 MB.' : 'Ukuran file maksimal 15 MB.');
  // Cloudinary treats PDFs as image assets so it can render their pages for a
  // browser preview. Other office documents stay raw and are download-only.
  return { fileName, mimeType, size, resourceType: isImage || isPdf ? 'image' : 'raw' };
}
