import { Hono } from 'hono';
import { LiveQuizRoom } from './durable/LiveQuizRoom.js';
import { errorResponse, json } from './http/response.js';
import { exactCors } from './middleware/cors.js';
import { registerAiRoutes } from './routes/ai.js';
import { registerClassRoutes } from './routes/classes.js';
import { registerMaterialRoutes } from './routes/materials.js';
import { registerDiscussionRoutes } from './routes/discussions.js';
import { registerAttendanceRoutes } from './routes/attendance.js';
import { registerLearningSessionRoutes } from './routes/learning-sessions.js';
import { registerQuizRoutes } from './routes/quizzes.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerGeneralQuizRoutes } from './routes/general-quizzes.js';
import { registerQuizBankRoutes } from './routes/quiz-bank.js';
import { registerLiveQuizRoutes } from './routes/live-quizzes.js';

const app = new Hono();

app.use('*', exactCors);
app.get('/', (c) => json(c, 200, { name: 'Nalaro Class API', status: 'online' }));
app.get('/health', async (c) => {
  if (!c.env.DB) return json(c, 503, { error: { code: 'SERVICE_NOT_READY', message: 'Basis data belum dikonfigurasi.' } });
  try {
    await c.env.DB.prepare('SELECT 1 AS ok').first();
    return json(c, 200, { data: { status: 'ok', service: 'nalaro-api' } });
  } catch {
    return json(c, 503, { error: { code: 'DATABASE_UNAVAILABLE', message: 'Basis data sedang tidak tersedia.' } });
  }
});

registerAiRoutes(app);
registerClassRoutes(app);
registerMaterialRoutes(app);
registerDiscussionRoutes(app);
registerAttendanceRoutes(app);
registerLearningSessionRoutes(app);
registerQuizRoutes(app);
registerTaskRoutes(app);
registerGeneralQuizRoutes(app);
registerQuizBankRoutes(app);
registerLiveQuizRoutes(app);

app.notFound((c) => json(c, 404, { error: { code: 'NOT_FOUND', message: 'Rute tidak ditemukan.' } }));
app.onError((error, c) => errorResponse(c, error));

export { LiveQuizRoom };
export default app;
