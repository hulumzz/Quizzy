import { ApiError, apiRequest } from './api';
import { optimizeImageForUpload } from '../lib/image-compression';

async function uploadAsset(signatureUrl, file) {
  const uploadFile = await optimizeImageForUpload(file);
  const data = await apiRequest(signatureUrl, {
    method: 'POST',
    body: { fileName: uploadFile.name, mimeType: uploadFile.type, size: uploadFile.size },
  });
  const upload = data.upload;
  const body = new FormData();
  body.append('file', uploadFile);
  body.append('api_key', upload.apiKey);
  body.append('signature', upload.signature);
  Object.entries(upload.parameters).forEach(([key, value]) => body.append(key, String(value)));
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(upload.cloudName)}/${upload.resourceType}/upload`, { method: 'POST', body });
  } catch {
    throw new ApiError('Unggahan tidak dapat terhubung. Coba lagi beberapa saat.', { code: 'UPLOAD_NETWORK_ERROR' });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.secure_url) throw new ApiError(payload.error?.message || 'File belum dapat diunggah.', { code: 'UPLOAD_FAILED', status: response.status });
  return { url: payload.secure_url, publicId: payload.public_id, bytes: payload.bytes, format: payload.format, name: file.name, mimeType: uploadFile.type };
}

export async function uploadMaterialAsset(classId, file, { generalQuiz = false } = {}) {
  const signatureUrl = generalQuiz ? '/general-quizzes/uploads/signature' : `/classes/${encodeURIComponent(classId)}/uploads/signature`;
  return uploadAsset(signatureUrl, file);
}

export async function uploadTaskAttachment(classId, taskId, file) {
  const asset = await uploadAsset(`/classes/${encodeURIComponent(classId)}/tasks/${encodeURIComponent(taskId)}/uploads/signature`, file);
  return { ...asset, bytes: asset.bytes || file.size };
}

export function uploadErrorMessage(error) {
  if (error?.code === 'UPLOAD_NOT_CONFIGURED') return 'Layanan unggahan sedang disiapkan. Coba lagi beberapa saat.';
  if (error?.code === 'FILE_TOO_LARGE' || error?.code === 'UNSUPPORTED_FILE_TYPE') return error.message;
  if (error?.status === 403) return 'Hanya pengelola kelas yang dapat mengunggah file.';
  if (error?.code === 'UPLOAD_NETWORK_ERROR' || error?.code === 'UPLOAD_FAILED') return 'File belum dapat diunggah. Coba lagi beberapa saat.';
  return error?.message || 'File belum dapat diunggah.';
}
