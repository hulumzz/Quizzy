import { forbidden } from '../http/errors.js';
import { json } from '../http/response.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { LearningAnalyticsRepository } from '../repositories/learning-analytics.repository.js';
import { validateClassId } from '../validation/classes.js';

function repository(c) {
  const classes = new ClassRepository(c.env.DB);
  return new LearningAnalyticsRepository({ db: c.env.DB, classRepository: classes });
}

function identity(c) {
  const auth = getAuth(c);
  if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat membuka analitik pembelajaran.');
  return auth;
}

export function registerLearningAnalyticsRoutes(app) {
  const base = '/classes/:classId/analytics';
  const classId = (c) => validateClassId(c.req.param('classId'));

  app.get(base, requireAuth, async (c) => {
    const auth = identity(c);
    return json(c, 200, { data: { analytics: await repository(c).getClassOverview(classId(c), auth.uid) } });
  });

  app.get(`${base}/me`, requireAuth, async (c) => {
    const auth = identity(c);
    return json(c, 200, { data: { analytics: await repository(c).getStudent(classId(c), auth.uid, auth.uid) } });
  });

  app.get(`${base}/students/:studentId`, requireAuth, async (c) => {
    const auth = identity(c);
    const studentId = String(c.req.param('studentId') || '').trim();
    if (!studentId || studentId.length > 160) throw forbidden('Identitas siswa tidak valid.');
    return json(c, 200, { data: { analytics: await repository(c).getStudent(classId(c), auth.uid, studentId) } });
  });
}
