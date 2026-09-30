import { forbidden, HttpError } from '../http/errors.js';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class CloudinaryUploadSigner {
  constructor({ classRepository, cloudName, apiKey, apiSecret, now = () => Date.now() }) {
    this.classRepository = classRepository; this.cloudName = cloudName; this.apiKey = apiKey; this.apiSecret = apiSecret; this.now = now;
  }

  async signedUpload({ folder, resourceType }) {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) throw new HttpError(503, 'UPLOAD_NOT_CONFIGURED', 'Layanan unggahan belum dikonfigurasi.');
    const parameters = { folder, overwrite: 'false', timestamp: Math.floor(this.now() / 1000), unique_filename: 'true', use_filename: 'true' };
    const payload = Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join('&');
    return { provider: 'cloudinary', cloudName: this.cloudName, apiKey: this.apiKey, resourceType, signatureAlgorithm: 'sha256', signature: await sha256(`${payload}${this.apiSecret}`), parameters };
  }

  async createSignature({ classId, uid, resourceType }) {
    const access = await this.classRepository.getForUser(classId, uid);
    if (access.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat mengunggah aset materi.');
    return this.signedUpload({ folder: `quizzy/classes/${classId}`, resourceType });
  }

  async createGeneralQuizSignature({ uid, resourceType }) {
    if (!uid) throw forbidden('Akun tidak valid untuk mengunggah aset kuis.');
    return this.signedUpload({ folder: `quizzy/general-quizzes/${uid}`, resourceType });
  }

  async createTaskSubmissionSignature({ classId, taskId, uid, resourceType }) {
    return this.signedUpload({ folder: `quizzy/classes/${classId}/tasks/${taskId}/submissions/${uid}`, resourceType });
  }
}
