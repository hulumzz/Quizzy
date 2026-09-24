import { ApiError, apiRequest } from './api';

export async function uploadMaterialAsset(classId, file, { generalQuiz = false } = {}) {
  const signatureUrl = generalQuiz ? '/general-quizzes/uploads/signature' : `/classes/${encodeURIComponent(classId)}/uploads/signature`;
  const data = await apiRequest(signatureUrl, {
    method: 'POST',
    body: { fileName: file.name, mimeType: file.type, size: file.size },
  });
  const upload = data.upload;
  const body = new FormData();
  body.append('file', file);
  body.append('api_key', upload.apiKey);
  body.append('signature', upload.signature);
  Object.entries(upload.parameters).forEach(([key, value]) => body.append(key, String(value)));
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(upload.cloudName)}/${upload.resourceType}/upload`, { method: 'POST', body });
  } catch {
    throw new ApiError('Tidak dapat terhubung ke Cloudinary.', { code: 'UPLOAD_NETWORK_ERROR' });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.secure_url) throw new ApiError(payload.error?.message || 'Cloudinary menolak unggahan.', { code: 'UPLOAD_FAILED', status: response.status });
  return { url: payload.secure_url, publicId: payload.public_id, bytes: payload.bytes, format: payload.format };
}

export function uploadErrorMessage(error) {
  if (error?.code === 'UPLOAD_NOT_CONFIGURED') return 'Cloudinary belum dikonfigurasi pada backend.';
  if (error?.code === 'FILE_TOO_LARGE' || error?.code === 'UNSUPPORTED_FILE_TYPE') return error.message;
  if (error?.status === 403) return 'Hanya pengelola kelas yang dapat mengunggah file.';
  return error?.message || 'File belum dapat diunggah.';
}
