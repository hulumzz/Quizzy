import { averageEmbeddings, cosineSimilarity, FACE_MATCH_THRESHOLD, FACE_MODEL_VERSION, FaceEngineError, inspectEnrollmentFace } from './face-engine.js';

const front = { id: 'front', label: 'Depan', instruction: 'Hadapkan wajah lurus ke kamera.', accepts: (yaw) => Math.abs(yaw) <= 8 };
const right = { id: 'right', label: 'Kanan', instruction: 'Putar kepala perlahan ke kanan Anda.', accepts: (yaw) => yaw >= 12 && yaw <= 28 };
const left = { id: 'left', label: 'Kiri', instruction: 'Putar kepala perlahan ke kiri Anda.', accepts: (yaw) => yaw <= -12 && yaw >= -28 };
export const ENROLLMENT_STEPS = [front, right, left, { ...front, id: 'finish', label: 'Selesai', instruction: 'Kembali hadap depan untuk menyelesaikan rekaman.' }];
export const verificationSteps = (challenge) => [front, challenge.id === 'look_left' ? left : right, { ...front, id: 'finish', label: 'Selesai', instruction: 'Kembali hadap depan untuk memverifikasi wajah.' }];

function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('Pemindaian dibatalkan.', 'AbortError');
}

const delay = (ms, signal) => new Promise((resolve, reject) => {
  checkAbort(signal);
  const abort = () => { clearTimeout(timer); reject(new DOMException('Pemindaian dibatalkan.', 'AbortError')); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  signal?.addEventListener('abort', abort, { once: true });
});

// One detector call at a time. A pose must remain valid across multiple frames.
// Only forward-facing embeddings are saved or matched; turns provide guidance/challenge evidence.
export async function scanGuidedFace(video, { steps = ENROLLMENT_STEPS, profile, signal, onProgress = () => {}, inspect = inspectEnrollmentFace, now = Date.now, wait = delay } = {}) {
  if (profile && profile.modelVersion !== FACE_MODEL_VERSION) throw new FaceEngineError('FACE_MODEL_MISMATCH', 'Profil wajah perlu didaftarkan ulang.');
  const samples = [];
  let reference = profile?.embedding;
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    const started = now();
    let heldSince = null;
    let frames = 0;
    let stepSamples = [];
    const progress = (guidance, hold = 0) => onProgress({ stage: 'guiding', current: stepIndex, total: steps.length, step, hold, guidance });
    progress({ tone: 'neutral', instruction: step.instruction, detail: 'Ikuti arah dari sisi Anda. Sampel diambil otomatis saat posisi stabil.' });
    while (true) {
      checkAbort(signal);
      if (now() - started > 35_000) throw new FaceEngineError('FACE_SCAN_TIMEOUT', 'Gerakan belum terbaca. Pastikan wajah berada di tengah dan pencahayaan cukup, lalu coba lagi.');
      let inspected;
      try { inspected = await inspect(video, { allowTurn: true }); }
      catch (error) {
        if (!['FACE_NOT_FOUND', 'MULTIPLE_FACES', 'FACE_EMBEDDING_MISSING', 'CAMERA_NOT_READY'].includes(error?.code)) throw error;
        inspected = { ready: false, tone: 'warning', instruction: error.message, detail: 'Pemindai akan memeriksa ulang otomatis.' };
      }
      checkAbort(signal);
      const face = inspected.face;
      const sameFace = !reference || (face && cosineSimilarity(reference, face.embedding) >= FACE_MATCH_THRESHOLD);
      const valid = inspected.ready && sameFace && step.accepts(face?.yaw);
      if (!valid) {
        heldSince = null; frames = 0; stepSamples = [];
        progress(!inspected.ready ? inspected : !sameFace ? { tone: 'warning', instruction: profile ? 'Wajah belum cocok dengan profil Anda.' : 'Pastikan wajah yang sama tetap di depan kamera.', detail: 'Perbaiki pencahayaan atau gunakan perangkat yang sama saat mendaftar.' } : { tone: 'neutral', instruction: step.instruction, detail: 'Putar sedikit saja dan jaga wajah tetap di dalam bingkai.' });
      } else {
        heldSince ??= now(); frames += 1;
        stepSamples.push(face.embedding);
        const hold = Math.min(1, (now() - heldSince) / 700);
        progress({ tone: 'success', instruction: step.instruction, detail: 'Posisi sudah tepat. Tahan sebentar…' }, hold);
        if (hold === 1 && frames >= 3) {
          if (step.id === 'front' || step.id === 'finish') samples.push(...stepSamples.slice(-3));
          reference ||= averageEmbeddings(stepSamples.slice(-3));
          break;
        }
      }
      await wait(180, signal);
    }
  }
  checkAbort(signal);
  const embedding = averageEmbeddings(samples);
  const similarity = profile ? cosineSimilarity(embedding, profile.embedding) : null;
  if (profile && similarity < FACE_MATCH_THRESHOLD) throw new FaceEngineError('FACE_NOT_MATCHED', 'Wajah belum cocok. Atur pencahayaan lalu coba lagi.');
  onProgress({ stage: 'complete', current: steps.length, total: steps.length, hold: 1, guidance: { tone: 'success', instruction: 'Pemindaian selesai.', detail: 'Semua langkah berhasil dibaca.' } });
  return { embedding, modelVersion: FACE_MODEL_VERSION, ...(profile ? { matched: true, challengeComplete: true, similarity } : {}) };
}
