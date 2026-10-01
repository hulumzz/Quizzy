import { badRequest, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { assertAccountRole, getAuth } from '../middleware/auth.js';
import { generateAiResponse } from '../services/ai.js';
import { verifyFirebaseToken } from '../services/firebase-auth.js';

const MAX_BODY_BYTES = 24_000;
const MAX_CONTEXT_CHARS = 5_300;
const MAX_INSTRUCTION_CHARS = 500;

async function requireAiAuth(c, next) {
  if (!c.env.FIREBASE_PROJECT_ID) throw new HttpError(503, 'AI_NOT_CONFIGURED', 'Asisten AI belum dikonfigurasi.');
  try {
    const authorization = c.req.header('authorization');
    c.set('auth', await verifyFirebaseToken(authorization, c.env.FIREBASE_PROJECT_ID));
    c.set('authToken', authorization);
  } catch (error) {
    if (error?.status === 401) throw new HttpError(401, 'AUTH_REQUIRED', 'Masuk diperlukan untuk menggunakan asisten AI.');
    throw error;
  }
  await next();
}

export function registerAiRoutes(app) {
  app.post('/api/ai/assist', requireAiAuth, async (c) => {
    const user = getAuth(c);
    await assertAccountRole(c, 'teacher');
    if (!c.env.AI_RATE_LIMITER || !c.env.GROQ_API_KEY) throw new HttpError(503, 'AI_NOT_CONFIGURED', 'Asisten AI belum dikonfigurasi.');
    const rate = await c.env.AI_RATE_LIMITER.limit({ key: user.uid });
    if (!rate.success) throw new HttpError(429, 'AI_RATE_LIMITED', 'Asisten sedang digunakan. Coba lagi dalam satu menit.');
    if (Number(c.req.header('content-length') || 0) > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Permintaan AI terlalu besar.');
    let input;
    try {
      const raw = await c.req.text();
      if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Permintaan AI terlalu besar.');
      input = JSON.parse(raw);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw badRequest('INVALID_REQUEST', 'Data AI harus berupa JSON valid.');
    }
    const task = typeof input?.task === 'string' ? input.task : '';
    const context = typeof input?.context === 'string' ? input.context.trim() : '';
    const instruction = typeof input?.instruction === 'string' ? input.instruction.trim() : '';
    if (!['material_draft', 'quiz_draft', 'assessment_feedback'].includes(task) || !context || context.length > MAX_CONTEXT_CHARS || instruction.length > MAX_INSTRUCTION_CHARS) throw badRequest('AI_INPUT_LIMIT', 'Referensi atau instruksi AI terlalu panjang.');
    return json(c, 200, { data: await generateAiResponse(c.env, { task, context, instruction }) });
  });
}
