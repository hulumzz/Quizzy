import { forbidden, notFound } from '../http/errors.js';

const chunks = (items, size = 50) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export async function persistLiveResultSnapshot(db, snapshot) {
  if (!db) throw new Error('D1 binding DB is required');
  const now = new Date().toISOString();
  const questions = Array.isArray(snapshot.questions) ? snapshot.questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: Number(q.points || 0),
  })) : [];
  const saved = await db.prepare(`INSERT INTO live_quiz_sessions(
      id,code,scope,class_id,learning_session_id,quiz_id,owner_id,title,questions_json,question_count,total_points,participant_count,started_at,finished_at,created_at,persisted_at,persistence_status
    ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,'pending')
    ON CONFLICT(id) DO UPDATE SET
      participant_count=excluded.participant_count,
      started_at=excluded.started_at,
      finished_at=excluded.finished_at,
      questions_json=excluded.questions_json,
      question_count=excluded.question_count,
      total_points=excluded.total_points,
      persisted_at=excluded.persisted_at,
      persistence_status='pending'
    WHERE live_quiz_sessions.owner_id=excluded.owner_id
      AND live_quiz_sessions.quiz_id=excluded.quiz_id`)
    .bind(
      snapshot.id,
      snapshot.code,
      snapshot.scope,
      snapshot.classId || null,
      snapshot.learningSessionId || null,
      snapshot.quizId,
      snapshot.ownerId,
      snapshot.title,
      JSON.stringify(questions),
      Number(snapshot.questionCount || questions.length),
      Number(snapshot.totalPoints || 0),
      Number(snapshot.participantCount || 0),
      snapshot.startedAt || null,
      snapshot.finishedAt,
      snapshot.createdAt,
      now,
    ).run();
  if (!saved.meta?.changes) throw new Error('Live session identity conflicts with an existing report');

  const participantStatements = (snapshot.participants || []).map((participant) => db.prepare(`INSERT INTO live_quiz_results(
      live_session_id,participant_id,student_id,participant_name,score,correct_count,rank,joined_at
    ) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)
    ON CONFLICT(live_session_id,participant_id) DO UPDATE SET
      student_id=excluded.student_id,
      participant_name=excluded.participant_name,
      score=excluded.score,
      correct_count=excluded.correct_count,
      rank=excluded.rank,
      joined_at=excluded.joined_at`)
    .bind(snapshot.id, participant.id, participant.studentId || null, participant.name, Number(participant.score || 0), Number(participant.correctCount || 0), Number(participant.rank || 0), participant.joinedAt));

  const answerStatements = (snapshot.answers || []).map((answer) => db.prepare(`INSERT INTO live_quiz_answer_results(
      live_session_id,question_id,participant_id,student_id,correct,earned_points,answered_at
    ) VALUES(?1,?2,?3,?4,?5,?6,?7)
    ON CONFLICT(live_session_id,question_id,participant_id) DO UPDATE SET
      student_id=excluded.student_id,
      correct=excluded.correct,
      earned_points=excluded.earned_points,
      answered_at=excluded.answered_at`)
    .bind(snapshot.id, answer.questionId, answer.participantId, answer.studentId || null, answer.correct ? 1 : 0, Number(answer.earnedPoints || 0), answer.answeredAt));

  for (const group of chunks(participantStatements)) await db.batch(group);
  for (const group of chunks(answerStatements)) await db.batch(group);
  await db.prepare("UPDATE live_quiz_sessions SET persistence_status='complete',persisted_at=?2 WHERE id=?1 AND owner_id=?3 AND quiz_id=?4")
    .bind(snapshot.id, now, snapshot.ownerId, snapshot.quizId).run();
  return { persistedAt: now, participants: participantStatements.length, answers: answerStatements.length };
}

function publicSession(row) {
  return {
    id: row.id,
    code: row.code,
    scope: row.scope,
    classId: row.class_id || null,
    learningSessionId: row.learning_session_id || null,
    quizId: row.quiz_id,
    title: row.title,
    questionCount: Number(row.question_count || 0),
    totalPoints: Number(row.total_points || 0),
    participantCount: Number(row.participant_count || 0),
    startedAt: row.started_at || null,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    persistedAt: row.persisted_at,
  };
}

const publicParticipant = (row) => ({
  participantId: row.participant_id,
  studentId: row.student_id || null,
  name: row.participant_name,
  score: Number(row.score || 0),
  correctCount: Number(row.correct_count || 0),
  rank: Number(row.rank || 0),
  joinedAt: row.joined_at,
});

export class LiveResultRepository {
  constructor({ db, classRepository }) {
    if (!db) throw new Error('D1 binding DB is required');
    this.db = db;
    this.classRepository = classRepository;
  }

  async requireClassOwner(classId, ownerId) {
    const access = await this.classRepository.getForUser(classId, ownerId);
    if (access.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat melihat hasil Nalaro Live.');
    return access;
  }

  async listClass(classId, ownerId) {
    await this.requireClassOwner(classId, ownerId);
    const rows = (await this.db.prepare("SELECT * FROM live_quiz_sessions WHERE class_id=?1 AND persistence_status='complete' ORDER BY finished_at DESC LIMIT 100").bind(classId).all()).results || [];
    return rows.map(publicSession);
  }

  async getClass(classId, liveSessionId, ownerId) {
    await this.requireClassOwner(classId, ownerId);
    const row = await this.db.prepare("SELECT * FROM live_quiz_sessions WHERE id=?1 AND class_id=?2 AND persistence_status='complete'").bind(liveSessionId, classId).first();
    if (!row) throw notFound('Hasil Nalaro Live tidak ditemukan.');
    const participants = (await this.db.prepare('SELECT * FROM live_quiz_results WHERE live_session_id=?1 ORDER BY rank ASC, joined_at ASC').bind(liveSessionId).all()).results || [];
    const questionRows = (await this.db.prepare(`SELECT question_id,
      COUNT(*) AS answer_count,
      SUM(CASE WHEN correct=1 THEN 1 ELSE 0 END) AS correct_count,
      SUM(earned_points) AS earned_points
      FROM live_quiz_answer_results
      WHERE live_session_id=?1
      GROUP BY question_id`).bind(liveSessionId).all()).results || [];
    const stats = new Map(questionRows.map((item) => [item.question_id, item]));
    const questions = (() => { try { return JSON.parse(row.questions_json || '[]'); } catch { return []; } })().map((question) => {
      const value = stats.get(question.id);
      const answerCount = Number(value?.answer_count || 0);
      const correctCount = Number(value?.correct_count || 0);
      return {
        ...question,
        answerCount,
        correctCount,
        accuracy: answerCount ? Math.round((correctCount / answerCount) * 1000) / 10 : null,
        earnedPoints: Number(value?.earned_points || 0),
      };
    });
    return { ...publicSession(row), participants: participants.map(publicParticipant), questions };
  }

  async listGeneral(ownerId) {
    const rows = (await this.db.prepare("SELECT * FROM live_quiz_sessions WHERE owner_id=?1 AND scope='general' AND persistence_status='complete' ORDER BY finished_at DESC LIMIT 100").bind(ownerId).all()).results || [];
    return rows.map(publicSession);
  }

  async getGeneral(liveSessionId, ownerId) {
    const row = await this.db.prepare("SELECT * FROM live_quiz_sessions WHERE id=?1 AND owner_id=?2 AND scope='general' AND persistence_status='complete'").bind(liveSessionId, ownerId).first();
    if (!row) throw notFound('Hasil Nalaro Live tidak ditemukan.');
    const participants = (await this.db.prepare('SELECT * FROM live_quiz_results WHERE live_session_id=?1 ORDER BY rank ASC, joined_at ASC').bind(liveSessionId).all()).results || [];
    return { ...publicSession(row), participants: participants.map(publicParticipant) };
  }
}

export function liveResultCsv(result) {
  const escape = (value) => {
    const raw = String(value ?? '');
    const text = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = [['Peringkat', 'Nama', 'Student ID', 'Skor', 'Benar', 'Waktu Bergabung']];
  for (const participant of result.participants || []) rows.push([
    participant.rank,
    participant.name,
    participant.studentId || '',
    participant.score,
    participant.correctCount,
    participant.joinedAt,
  ]);
  return rows.map((row) => row.map(escape).join(',')).join('\n');
}
