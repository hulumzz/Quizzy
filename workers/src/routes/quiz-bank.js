import { badRequest, forbidden, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { QUIZ_LEVELS, QUIZ_SUBJECTS } from '../domain/quiz-taxonomy.js';
import { assertAccountRole, getAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { GeneralQuizRepository } from '../repositories/general-quiz.repository.js';
import { LearningSessionRepository } from '../repositories/learning-session.repository.js';
import { QuizBankRepository } from '../repositories/quiz-bank.repository.js';
import { QuizRepository } from '../repositories/quiz.repository.js';
import { validateQuizBankCatalogId, validateQuizBankCopy, validateQuizBankPublish, validateQuizBankQuery } from '../validation/quiz-bank.js';

async function body(c) {
  if (Number(c.req.header('content-length') || 0) > 16_384) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data Bank Kuis terlalu besar.');
  const raw = await c.req.text();
  if (!raw) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.');
  if (raw.length > 16_384) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data Bank Kuis terlalu besar.');
  try { return JSON.parse(raw); } catch { throw badRequest('INVALID_JSON', 'Format data tidak valid.'); }
}
async function owner(c) { const auth = getAuth(c); if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan Bank Kuis.'); await assertAccountRole(c, 'teacher'); return auth.uid; }
function repository(c) {
  const classes = new ClassRepository(c.env.DB);
  const quiz = new QuizRepository({ db: c.env.DB, classRepository: classes, learningSessionRepository: new LearningSessionRepository({ db: c.env.DB, classRepository: classes }) });
  return new QuizBankRepository({ db: c.env.DB, quizRepository: quiz, generalQuizRepository: new GeneralQuizRepository(c.env.DB) });
}
export function registerQuizBankRoutes(app) {
  app.get('/quiz-bank/taxonomy', requireAuth, async (c) => { await owner(c); return json(c, 200, { data: { levels: QUIZ_LEVELS, subjects: QUIZ_SUBJECTS } }); });
  app.get('/quiz-bank/mine', requireAuth, async (c) => json(c, 200, { data: { quizzes: await repository(c).listMine(await owner(c)) } }));
  app.get('/quiz-bank', requireAuth, async (c) => json(c, 200, { data: { quizzes: await repository(c).list(validateQuizBankQuery({ level: c.req.query('level'), subject: c.req.query('subject') })) } }));
  app.post('/quiz-bank/publish', requireAuth, async (c) => json(c, 201, { data: { quiz: await repository(c).publish({ ownerId: await owner(c), ...validateQuizBankPublish(await body(c)) }) } }));
  app.post('/quiz-bank/:catalogId/copy', requireAuth, async (c) => json(c, 201, { data: { quiz: await repository(c).copyToClass({ catalogId: validateQuizBankCatalogId(c.req.param('catalogId')), ownerId: await owner(c), ...validateQuizBankCopy(await body(c)) }) } }));
  app.delete('/quiz-bank/:catalogId', requireAuth, async (c) => { await repository(c).unpublish({ catalogId: validateQuizBankCatalogId(c.req.param('catalogId')), ownerId: await owner(c) }); return c.body(null, 204); });
}
