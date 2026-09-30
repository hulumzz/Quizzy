import { badRequest, forbidden, HttpError } from '../http/errors.js';
import { json } from '../http/response.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { ClassRepository } from '../repositories/class.repository.js';
import { AttendanceRepository } from '../repositories/attendance.repository.js';
import { LearningSessionRepository } from '../repositories/learning-session.repository.js';
import { validateClassId } from '../validation/classes.js';
import { validateAttendanceId, validateAttendanceInput, validateAttendanceStatus, validateCheckIn } from '../validation/attendance.js';

const MAX_BODY_BYTES = 8_192;
async function body(c) { if (Number(c.req.header('content-length') || 0) > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data presensi terlalu besar.'); const raw = await c.req.text(); if (!raw) throw badRequest('INVALID_BODY', 'Data permintaan wajib diisi.'); if (raw.length > MAX_BODY_BYTES) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Data presensi terlalu besar.'); try { return JSON.parse(raw); } catch { throw badRequest('INVALID_JSON', 'Format data presensi tidak valid.'); } }
function displayName(identity) { const emailName = identity.email?.split('@')[0]?.replace(/[._-]+/g, ' '); return (identity.name || emailName || 'Siswa Quizzy').trim().slice(0, 80); }
function repository(c) { const classes = new ClassRepository(c.env.DB); return new AttendanceRepository({ db: c.env.DB, classRepository: classes, learningSessionRepository: new LearningSessionRepository({ db: c.env.DB, classRepository: classes }) }); }

export function registerAttendanceRoutes(app) {
  const base = '/classes/:classId/attendance'; const classId = (c) => validateClassId(c.req.param('classId')); const identity = (c) => { const auth = getAuth(c); if (auth.signInProvider === 'anonymous') throw forbidden('Akun tamu tidak dapat menggunakan presensi.'); return auth; };
  app.get(base, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { attendance: await repository(c).list(classId(c), auth.uid) } }); });
  app.post(base, requireAuth, async (c) => { const auth = identity(c); const attendance = await repository(c).create({ classId: classId(c), ownerId: auth.uid, ...validateAttendanceInput(await body(c)) }); return json(c, 201, { data: { attendance } }); });
  app.get(`${base}/:attendanceId`, requireAuth, async (c) => { const auth = identity(c); return json(c, 200, { data: { attendance: await repository(c).detail(classId(c), validateAttendanceId(c.req.param('attendanceId')), auth.uid) } }); });
  app.put(`${base}/:attendanceId/status`, requireAuth, async (c) => { const auth = identity(c); const attendance = await repository(c).setStatus({ classId: classId(c), attendanceId: validateAttendanceId(c.req.param('attendanceId')), ownerId: auth.uid, ...validateAttendanceStatus(await body(c)) }); return json(c, 200, { data: { attendance } }); });
  app.post(`${base}/:attendanceId/check-in`, requireAuth, async (c) => { const auth = identity(c); const checkIn = await repository(c).checkIn({ classId: classId(c), attendanceId: validateAttendanceId(c.req.param('attendanceId')), uid: auth.uid, name: displayName(auth), ...validateCheckIn(await body(c)) }); return json(c, 200, { data: { checkIn } }); });
}
