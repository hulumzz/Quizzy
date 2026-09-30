import { conflict, forbidden, notFound } from '../http/errors.js';

const parse = (value, fallback = []) => { try { return JSON.parse(value || ''); } catch { return fallback; } };
const publicTask = (row, extra = {}) => ({
  id: row.id, classId: row.class_id, title: row.title, instructions: row.instructions,
  dueAt: row.due_at, responseMode: row.response_mode, status: row.status,
  sessionId: row.session_id || null, createdAt: row.created_at, updatedAt: row.updated_at,
  publishedAt: row.published_at || null, ...extra,
});
const publicSubmission = (row, extra = {}) => row ? ({
  studentId: row.student_id, studentName: row.student_name, textAnswer: row.text_answer,
  attachments: parse(row.attachments_json), status: row.status, late: Boolean(row.late),
  submittedAt: row.submitted_at, attemptNumber: row.attempt_number,
  revisionCount: row.revision_count, score: row.score ?? null, feedback: row.feedback || '',
  gradedAt: row.graded_at || null, gradedBy: row.graded_by || null,
  returnedAt: row.returned_at || null, ...extra,
}) : null;
const publicRevision = (row) => {
  const previous = parse(row.previous_json, {});
  return {
    previousStatus: previous.status, previousScore: previous.score ?? null,
    previousFeedback: previous.feedback || '', previousTextAnswer: previous.textAnswer || '',
    previousAttachments: previous.attachments || [], previousSubmittedAt: previous.submittedAt,
    previousAttemptNumber: previous.attemptNumber, createdAt: row.created_at,
  };
};
const revisionSnapshot = (row) => JSON.stringify({
  status: row.status, score: row.score, feedback: row.feedback, textAnswer: row.text_answer,
  attachments: parse(row.attachments_json), submittedAt: row.submitted_at,
  attemptNumber: row.attempt_number,
});

export class TaskRepository {
  constructor({ db, classRepository, learningSessionRepository, cloudName }) {
    this.db = db;
    this.classRepository = classRepository;
    this.learningSessionRepository = learningSessionRepository;
    this.cloudName = cloudName;
  }

  async access(classId, uid) { return this.classRepository.getForUser(classId, uid); }
  async owner(classId, uid) {
    const access = await this.access(classId, uid);
    if (access.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat mengatur tugas.');
    return access;
  }
  async item(classId, taskId) {
    const row = await this.db.prepare("SELECT * FROM tasks WHERE class_id=?1 AND id=?2 AND status<>'deleted'").bind(classId, taskId).first();
    if (!row) throw notFound('Tugas tidak ditemukan.');
    return row;
  }
  async memberTask(classId, taskId, uid) {
    const access = await this.access(classId, uid);
    const task = await this.item(classId, taskId);
    if (access.accessRole !== 'member' || task.status !== 'published') throw forbidden('Pengumpulan tugas hanya tersedia untuk siswa.');
    return task;
  }

  async list(classId, uid) {
    const access = await this.access(classId, uid);
    if (access.accessRole === 'owner') {
      const rows = (await this.db.prepare("SELECT * FROM tasks WHERE class_id=?1 AND status<>'deleted' ORDER BY due_at ASC LIMIT 100").bind(classId).all()).results || [];
      return rows.map((row) => publicTask(row, { accessRole: 'owner' }));
    }
    const rows = (await this.db.prepare("SELECT t.*,s.student_id AS submission_student_id,s.student_name AS submission_student_name,s.text_answer AS submission_text_answer,s.attachments_json AS submission_attachments_json,s.status AS submission_status,s.late AS submission_late,s.submitted_at AS submission_submitted_at,s.attempt_number AS submission_attempt_number,s.revision_count AS submission_revision_count,s.score AS submission_score,s.feedback AS submission_feedback,s.graded_at AS submission_graded_at,s.graded_by AS submission_graded_by,s.returned_at AS submission_returned_at FROM tasks t LEFT JOIN task_submissions s ON s.task_id=t.id AND s.student_id=?2 WHERE t.class_id=?1 AND t.status='published' ORDER BY t.due_at ASC LIMIT 100").bind(classId, uid).all()).results || [];
    return rows.map((row) => publicTask(row, { accessRole: 'member', submission: row.submission_student_id ? publicSubmission({
      student_id: row.submission_student_id, student_name: row.submission_student_name,
      text_answer: row.submission_text_answer, attachments_json: row.submission_attachments_json,
      status: row.submission_status, late: row.submission_late, submitted_at: row.submission_submitted_at,
      attempt_number: row.submission_attempt_number, revision_count: row.submission_revision_count,
      score: row.submission_score, feedback: row.submission_feedback,
      graded_at: row.submission_graded_at, graded_by: row.submission_graded_by,
      returned_at: row.submission_returned_at,
    }) : null }));
  }

  async create({ classId, ownerId, title, instructions, dueAt, responseMode, status, sessionId, now = new Date().toISOString() }) {
    await this.owner(classId, ownerId);
    if (sessionId) await this.learningSessionRepository.requireAssignable(classId, sessionId, ownerId);
    const id = crypto.randomUUID();
    await this.db.prepare('INSERT INTO tasks(id,class_id,owner_id,session_id,title,instructions,due_at,response_mode,status,published_at,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)').bind(id, classId, ownerId, sessionId, title, instructions, dueAt, responseMode, status, status === 'published' ? now : null, now).run();
    return publicTask({ id, class_id: classId, session_id: sessionId, title, instructions, due_at: dueAt, response_mode: responseMode, status, published_at: status === 'published' ? now : null, created_at: now, updated_at: now }, { accessRole: 'owner' });
  }

  async update({ classId, taskId, ownerId, title, instructions, dueAt, responseMode, status, sessionId, now = new Date().toISOString() }) {
    await this.owner(classId, ownerId);
    const current = await this.item(classId, taskId);
    if (current.owner_id !== ownerId) throw forbidden('Hanya pengelola tugas yang dapat mengubah tugas.');
    if (sessionId && sessionId !== current.session_id) await this.learningSessionRepository.requireAssignable(classId, sessionId, ownerId);
    const updated = await this.db.prepare("UPDATE tasks SET session_id=?3,title=?4,instructions=?5,due_at=?6,response_mode=?7,status=?8,published_at=?9,updated_at=?10 WHERE class_id=?1 AND id=?2 AND owner_id=?11 AND status<>'deleted'").bind(classId, taskId, sessionId, title, instructions, dueAt, responseMode, status, status === 'published' ? current.published_at || now : null, now, ownerId).run();
    if (!updated.meta?.changes) throw notFound('Tugas tidak ditemukan.');
    return publicTask(await this.item(classId, taskId), { accessRole: 'owner' });
  }

  async history(taskId, uid) {
    const rows = (await this.db.prepare('SELECT previous_json,created_at FROM task_submission_revisions WHERE task_id=?1 AND student_id=?2 ORDER BY created_at DESC LIMIT 100').bind(taskId, uid).all()).results || [];
    return rows.map(publicRevision);
  }
  async get(classId, taskId, uid) {
    const access = await this.access(classId, uid);
    const task = await this.item(classId, taskId);
    if (access.accessRole !== 'owner' && task.status !== 'published') throw notFound('Tugas tidak ditemukan.');
    if (access.accessRole === 'owner') return publicTask(task, { accessRole: 'owner' });
    const submission = await this.db.prepare('SELECT * FROM task_submissions WHERE task_id=?1 AND student_id=?2').bind(taskId, uid).first();
    return publicTask(task, { accessRole: 'member', submission: submission ? publicSubmission(submission, { history: await this.history(taskId, uid) }) : null });
  }

  async prepareAttachmentUpload({ classId, taskId, uid }) {
    const task = await this.memberTask(classId, taskId, uid);
    if (task.response_mode === 'text') throw conflict('ATTACHMENT_NOT_ALLOWED', 'Tugas ini hanya menerima jawaban teks.');
    const existing = await this.db.prepare('SELECT status FROM task_submissions WHERE task_id=?1 AND student_id=?2').bind(taskId, uid).first();
    if (existing && existing.status !== 'returned') throw conflict('SUBMISSION_LOCKED', 'Jawaban sudah terkunci.');
    return task;
  }

  validateAttachments(classId, taskId, uid, attachments) {
    const folder = `quizzy/classes/${classId}/tasks/${taskId}/submissions/${uid}/`;
    for (const file of attachments) {
      if (!file.publicId.startsWith(folder) || !this.cloudName) throw forbidden('Lampiran tidak sesuai dengan tugas ini.');
      let url;
      try { url = new URL(file.url); } catch { throw forbidden('Tautan lampiran tidak valid.'); }
      const prefix = `/${this.cloudName}/`;
      let path;
      try { path = decodeURIComponent(url.pathname); } catch { throw forbidden('Tautan lampiran tidak valid.'); }
      const assetPath = path.slice(prefix.length);
      const suffix = `/${file.publicId}`;
      const trailing = path.slice(path.lastIndexOf(suffix) + suffix.length);
      if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || !path.startsWith(prefix) || !/^(image|raw)\/upload\//.test(assetPath) || !path.includes(suffix) || (trailing !== '' && !/^\.[A-Za-z0-9]{1,8}$/.test(trailing))) throw forbidden('Tautan lampiran tidak sesuai dengan unggahan.');
    }
  }

  async submit({ classId, taskId, uid, studentName, textAnswer, attachments, now = new Date().toISOString() }) {
    const task = await this.memberTask(classId, taskId, uid);
    if ((task.response_mode === 'text' && !textAnswer) || (task.response_mode === 'attachment' && !attachments.length) || (task.response_mode === 'both' && (!textAnswer || !attachments.length))) throw conflict('ANSWER_REQUIRED', 'Jawaban tugas belum lengkap.');
    if (attachments.length) this.validateAttachments(classId, taskId, uid, attachments);
    const previous = await this.db.prepare('SELECT * FROM task_submissions WHERE task_id=?1 AND student_id=?2').bind(taskId, uid).first();
    if (previous && previous.status !== 'returned') throw conflict('SUBMISSION_LOCKED', 'Jawaban sudah terkunci.');
    const late = Date.parse(now) > Date.parse(task.due_at);
    const status = late ? 'late' : 'submitted';
    const values = [taskId, uid, classId, studentName, textAnswer, JSON.stringify(attachments), status, late ? 1 : 0, now];
    if (previous) {
      const revision = this.db.prepare("INSERT INTO task_submission_revisions(id,task_id,student_id,previous_json,created_at) SELECT ?1,task_id,student_id,?2,?3 FROM task_submissions WHERE task_id=?4 AND student_id=?5 AND status='returned' AND updated_at=?6").bind(crypto.randomUUID(), revisionSnapshot(previous), now, taskId, uid, previous.updated_at);
      const update = this.db.prepare("UPDATE task_submissions SET student_name=?3,text_answer=?4,attachments_json=?5,status=?6,late=?7,submitted_at=?8,attempt_number=attempt_number+1,revision_count=revision_count+1,score=NULL,feedback='',graded_at=NULL,graded_by=NULL,returned_at=NULL,updated_at=?8 WHERE task_id=?1 AND student_id=?2 AND status='returned' AND updated_at=?9").bind(taskId, uid, studentName, textAnswer, JSON.stringify(attachments), status, late ? 1 : 0, now, previous.updated_at);
      const results = await this.db.batch([revision, update]);
      if (!results[1].meta?.changes) throw conflict('SUBMISSION_LOCKED', 'Jawaban sudah terkunci.');
    } else {
      const inserted = await this.db.prepare('INSERT INTO task_submissions(task_id,student_id,class_id,student_name,text_answer,attachments_json,status,late,submitted_at,attempt_number,revision_count,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,1,0,?9) ON CONFLICT(task_id,student_id) DO NOTHING').bind(...values).run();
      if (!inserted.meta?.changes) throw conflict('SUBMISSION_LOCKED', 'Jawaban sudah terkunci.');
    }
    return publicSubmission(await this.db.prepare('SELECT * FROM task_submissions WHERE task_id=?1 AND student_id=?2').bind(taskId, uid).first());
  }

  async listSubmissions({ classId, taskId, ownerId }) {
    await this.owner(classId, ownerId);
    const task = await this.item(classId, taskId);
    if (task.owner_id !== ownerId) throw forbidden('Hanya pengelola tugas yang dapat melihat pengumpulan.');
    const rows = (await this.db.prepare('SELECT * FROM task_submissions WHERE task_id=?1 ORDER BY submitted_at DESC LIMIT 100').bind(taskId).all()).results || [];
    return rows.map(publicSubmission);
  }
  async grade({ classId, taskId, studentId, ownerId, status, score, feedback, now = new Date().toISOString() }) {
    await this.owner(classId, ownerId);
    const task = await this.item(classId, taskId);
    if (task.owner_id !== ownerId) throw forbidden('Hanya pengelola tugas yang dapat memberi nilai.');
    const current = await this.db.prepare('SELECT * FROM task_submissions WHERE task_id=?1 AND student_id=?2').bind(taskId, studentId).first();
    if (!current) throw notFound('Pengumpulan siswa tidak ditemukan.');
    const revision = this.db.prepare('INSERT INTO task_submission_revisions(id,task_id,student_id,previous_json,created_at) SELECT ?1,task_id,student_id,?2,?3 FROM task_submissions WHERE task_id=?4 AND student_id=?5 AND updated_at=?6').bind(crypto.randomUUID(), revisionSnapshot(current), now, taskId, studentId, current.updated_at);
    const update = this.db.prepare('UPDATE task_submissions SET status=?3,score=?4,feedback=?5,graded_at=?6,graded_by=?7,returned_at=?8,updated_at=?9 WHERE task_id=?1 AND student_id=?2 AND updated_at=?10').bind(taskId, studentId, status, score, feedback, status === 'graded' ? now : null, status === 'graded' ? ownerId : null, status === 'returned' ? now : null, now, current.updated_at);
    const results = await this.db.batch([revision, update]);
    if (!results[1].meta?.changes) throw conflict('SUBMISSION_CHANGED', 'Pengumpulan berubah. Muat ulang sebelum memberi nilai.');
    return publicSubmission(await this.db.prepare('SELECT * FROM task_submissions WHERE task_id=?1 AND student_id=?2').bind(taskId, studentId).first());
  }
}
