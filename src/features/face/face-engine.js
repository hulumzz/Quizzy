import { createFaceChallenge, isChallengeComplete } from './face-challenge.js';

export const FACE_MODEL_VERSION = 'human-v1';
export const FACE_MATCH_THRESHOLD = 0.72;
const MODEL_BASE_PATH = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/';
let enginePromise;

export class FaceEngineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FaceEngineError';
    this.code = code;
  }
}

export function averageEmbeddings(embeddings) {
  if (!Array.isArray(embeddings) || !embeddings.length) throw new FaceEngineError('FACE_EMBEDDING_MISSING', 'Wajah belum dapat dibaca.');
  const size = embeddings[0]?.length;
  if (!Number.isInteger(size) || !embeddings.every((embedding) => Array.isArray(embedding) && embedding.length === size)) {
    throw new FaceEngineError('FACE_EMBEDDING_INVALID', 'Data wajah tidak konsisten. Coba ulangi pengambilan sampel.');
  }
  return Array.from({ length: size }, (_, index) => embeddings.reduce((sum, embedding) => sum + embedding[index], 0) / embeddings.length);
}

export function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || !left.length) return 0;
  let dot = 0; let leftMagnitude = 0; let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (!Number.isFinite(left[index]) || !Number.isFinite(right[index])) return 0;
    dot += left[index] * right[index]; leftMagnitude += left[index] ** 2; rightMagnitude += right[index] ** 2;
  }
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : 0;
}

async function getEngine() {
  if (!enginePromise) enginePromise = (async () => {
    const { default: Human } = await import('@vladmandic/human');
    const human = new Human({
      backend: 'webgl', modelBasePath: MODEL_BASE_PATH, cacheModels: true, debug: false, async: true,
      face: {
        enabled: true,
        detector: { enabled: true, maxDetected: 2, minConfidence: 0.55, minSize: 120, rotation: true, return: false },
        mesh: { enabled: true }, description: { enabled: true, minConfidence: 0.5 }, liveness: { enabled: false },
        emotion: { enabled: false }, iris: { enabled: false }, antispoof: { enabled: false }, attention: { enabled: false }, gear: { enabled: false },
      },
      body: { enabled: false }, hand: { enabled: false }, object: { enabled: false }, segmentation: { enabled: false },
    });
    await human.load();
    return human;
  })().catch((error) => { enginePromise = undefined; throw error; });
  return enginePromise;
}

function readFace(result) {
  const faces = result?.face || [];
  if (!faces.length) throw new FaceEngineError('FACE_NOT_FOUND', 'Wajah belum terlihat. Hadapkan wajah ke kamera.');
  if (faces.length !== 1) throw new FaceEngineError('MULTIPLE_FACES', 'Pastikan hanya satu wajah berada di depan kamera.');
  const face = faces[0];
  if (!Array.isArray(face.embedding) || face.embedding.length < 64) throw new FaceEngineError('FACE_EMBEDDING_MISSING', 'Wajah belum dapat dibaca. Pastikan pencahayaan cukup lalu coba lagi.');
  return {
    embedding: face.embedding,
    yaw: face.rotation?.angle?.yaw ?? 0,
    pitch: face.rotation?.angle?.pitch ?? 0,
    confidence: face.score,
    box: face.boxRaw || face.box || null,
    livenessScore: face.live ?? null,
  };
}

export async function inspectFace(video) {
  if (!video?.srcObject || video.readyState < 2) throw new FaceEngineError('CAMERA_NOT_READY', 'Kamera belum siap. Tunggu sebentar lalu coba lagi.');
  return readFace(await (await getEngine()).detect(video));
}

export async function warmFaceEngine() {
  await getEngine();
}

function frameBrightness(video) {
  if (!video?.videoWidth || !video?.videoHeight || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 24; canvas.height = 18;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let total = 0;
  for (let index = 0; index < pixels.length; index += 4) total += (pixels[index] * 0.2126) + (pixels[index + 1] * 0.7152) + (pixels[index + 2] * 0.0722);
  return total / (pixels.length / 4);
}

export function enrollmentGuidance(face, brightness = null) {
  const [x, y, width, height] = Array.isArray(face?.box) ? face.box : [];
  const size = Math.max(width || 0, height || 0);
  const centerX = (x || 0) + ((width || 0) / 2);
  const centerY = (y || 0) + ((height || 0) / 2);
  if ((face?.confidence || 0) < 0.62) return { ready: false, tone: 'warning', instruction: 'Cari pencahayaan yang lebih merata.', detail: 'Wajah terlihat, tetapi belum cukup jelas.' };
  if (brightness !== null && brightness < 58) return { ready: false, tone: 'warning', instruction: 'Tambahkan pencahayaan di depan wajah.', detail: 'Area kamera terlihat terlalu gelap.' };
  if (brightness !== null && brightness > 235) return { ready: false, tone: 'warning', instruction: 'Hindari cahaya yang terlalu menyilaukan.', detail: 'Kurangi pantulan atau arahkan kamera sedikit.' };
  if (size < 0.22) return { ready: false, tone: 'warning', instruction: 'Dekatkan wajah ke bingkai.', detail: 'Wajah masih terlalu jauh dari kamera.' };
  if (size > 0.72) return { ready: false, tone: 'warning', instruction: 'Jauhkan wajah sedikit dari kamera.', detail: 'Wajah terlalu dekat dengan kamera.' };
  if (centerX < 0.38) return { ready: false, tone: 'warning', instruction: 'Geser wajah sedikit ke kanan.', detail: 'Pusatkan wajah di dalam bingkai.' };
  if (centerX > 0.62) return { ready: false, tone: 'warning', instruction: 'Geser wajah sedikit ke kiri.', detail: 'Pusatkan wajah di dalam bingkai.' };
  if (centerY < 0.36 || centerY > 0.65) return { ready: false, tone: 'warning', instruction: 'Atur tinggi kamera agar wajah berada di tengah.', detail: 'Pusatkan wajah di dalam bingkai.' };
  if (Math.abs(face?.yaw || 0) > 16 || Math.abs(face?.pitch || 0) > 15) return { ready: false, tone: 'warning', instruction: 'Hadapkan wajah lurus ke kamera.', detail: 'Tahan kepala tetap tegak sejenak.' };
  return { ready: true, tone: 'success', instruction: 'Posisi sudah baik. Tahan tetap di dalam bingkai.', detail: 'Siap mengambil tiga sampel wajah.' };
}

export async function inspectEnrollmentFace(video) {
  const face = await inspectFace(video);
  return { face, ...enrollmentGuidance(face, frameBrightness(video)) };
}

export async function enrollFace(video, sampleCount = 3, onProgress = () => {}) {
  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    onProgress({ current: index, total: sampleCount, phase: 'reading' });
    const inspected = await inspectEnrollmentFace(video);
    if (!inspected.ready) throw new FaceEngineError('FACE_QUALITY', `${inspected.instruction} ${inspected.detail}`);
    samples.push(inspected.face.embedding);
    onProgress({ current: index + 1, total: sampleCount, phase: 'captured' });
    if (index < sampleCount - 1) await new Promise((resolve) => window.setTimeout(resolve, 450));
  }
  onProgress({ current: sampleCount, total: sampleCount, phase: 'complete' });
  return { embedding: averageEmbeddings(samples), modelVersion: FACE_MODEL_VERSION };
}

export async function verifyFace(video, profile, challenge = createFaceChallenge()) {
  if (profile?.modelVersion !== FACE_MODEL_VERSION) throw new FaceEngineError('FACE_MODEL_MISMATCH', 'Profil wajah perlu didaftarkan ulang pada perangkat ini.');
  const current = await inspectFace(video);
  const similarity = cosineSimilarity(current.embedding, profile.embedding);
  return {
    matched: similarity >= FACE_MATCH_THRESHOLD && isChallengeComplete(challenge, current.yaw),
    similarity,
    modelVersion: FACE_MODEL_VERSION,
    challenge,
    challengeComplete: isChallengeComplete(challenge, current.yaw),
    livenessScore: current.livenessScore,
  };
}

export async function startFaceCamera(video) {
  if (!window.isSecureContext) throw new FaceEngineError('CAMERA_INSECURE_CONTEXT', 'Akses kamera di perangkat ini memerlukan alamat HTTPS. Buka melalui URL tunnel HTTPS, bukan IP jaringan dengan HTTP.');
  if (!navigator.mediaDevices?.getUserMedia) throw new FaceEngineError('CAMERA_UNSUPPORTED', 'Browser ini belum mendukung akses kamera.');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopFaceCamera(video) {
  const stream = video?.srcObject;
  stream?.getTracks?.().forEach((track) => track.stop());
  if (video) video.srcObject = null;
}

export function faceErrorMessage(error) {
  if (error?.code === 'CAMERA_INSECURE_CONTEXT') return error.message;
  if (error?.code === 'CAMERA_UNSUPPORTED') return error.message;
  if (error?.name === 'NotAllowedError') return 'Izin kamera ditolak. Aktifkan izin kamera di browser lalu coba lagi.';
  if (error?.name === 'NotFoundError') return 'Kamera tidak ditemukan pada perangkat ini.';
  if (error instanceof FaceEngineError) return error.message;
  return 'Pemeriksaan wajah belum dapat dijalankan. Periksa koneksi dan coba lagi.';
}
