import { createHash } from 'node:crypto';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { HttpError, forbidden } from '../http/errors.js';

function signatureFor(parameters, apiSecret) {
  const payload = Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return createHash('sha256').update(`${payload}${apiSecret}`).digest('hex');
}

export class CloudinaryUploadSigner {
  constructor({ classRepository, cloudName = process.env.CLOUDINARY_CLOUD_NAME, apiKey = process.env.CLOUDINARY_API_KEY, apiSecret = process.env.CLOUDINARY_API_SECRET, apiSecretParameter = process.env.CLOUDINARY_API_SECRET_PARAMETER, ssmClient = new SSMClient({}), now = () => Date.now() } = {}) {
    if (!classRepository) throw new Error('classRepository is required');
    this.classRepository = classRepository;
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.apiSecretParameter = apiSecretParameter;
    this.ssmClient = ssmClient;
    this.apiSecretPromise = null;
    this.now = now;
  }

  async getApiSecret() {
    if (this.apiSecret) return this.apiSecret;
    if (!this.apiSecretParameter) throw new HttpError(503, 'UPLOAD_NOT_CONFIGURED', 'Layanan unggahan belum dikonfigurasi.');
    if (!this.apiSecretPromise) {
      this.apiSecretPromise = this.ssmClient.send(new GetParameterCommand({ Name: this.apiSecretParameter, WithDecryption: true }))
        .then((result) => {
          if (!result.Parameter?.Value) throw new HttpError(503, 'UPLOAD_NOT_CONFIGURED', 'Layanan unggahan belum dikonfigurasi.');
          return result.Parameter.Value;
        })
        .catch((error) => {
          this.apiSecretPromise = null;
          if (error instanceof HttpError) throw error;
          throw new HttpError(503, 'UPLOAD_CONFIGURATION_UNAVAILABLE', 'Konfigurasi unggahan sedang tidak tersedia.');
        });
    }
    return this.apiSecretPromise;
  }

  async signedUpload({ folder, resourceType }) {
    if (!this.cloudName || !this.apiKey) throw new HttpError(503, 'UPLOAD_NOT_CONFIGURED', 'Layanan unggahan belum dikonfigurasi.');
    const parameters = {
      folder,
      overwrite: 'false',
      timestamp: Math.floor(this.now() / 1000),
      unique_filename: 'true',
      use_filename: 'true',
    };
    return {
      provider: 'cloudinary', cloudName: this.cloudName, apiKey: this.apiKey, resourceType,
      signatureAlgorithm: 'sha256', signature: signatureFor(parameters, await this.getApiSecret()), parameters,
    };
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
}
