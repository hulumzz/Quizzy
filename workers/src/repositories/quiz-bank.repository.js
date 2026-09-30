import { forbidden, notFound } from '../http/errors.js';
import { quizSubjectById } from '../domain/quiz-taxonomy.js';

const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const summary = (row) => ({
  id: row.id, title: row.title, description: row.description || '', questionCount: row.question_count,
  totalPoints: row.total_points, level: row.level, subject: quizSubjectById(row.subject_id),
  subjectId: row.subject_id, tags: parse(row.tags_json, []), license: row.license,
  authorId: row.author_id, sourceType: row.source_type, sourceQuizId: row.source_quiz_id,
  publishedAt: row.published_at, updatedAt: row.updated_at,
});

export class QuizBankRepository {
  constructor({ db, quizRepository, generalQuizRepository }) {
    this.db = db; this.quizRepository = quizRepository; this.generalQuizRepository = generalQuizRepository;
  }
  async catalog(id) {
    const row = await this.db.prepare("SELECT * FROM quiz_bank_catalog WHERE id=?1 AND status='published'").bind(id).first();
    if (!row) throw notFound('Kuis bank tidak ditemukan atau sudah ditarik.');
    return row;
  }
  async list({ level, subjectId }) {
    const rows = (await this.db.prepare("SELECT * FROM quiz_bank_catalog WHERE status='published' AND (?1='all' OR level=?1) AND (?2='all' OR subject_id=?2) ORDER BY published_at DESC LIMIT 60").bind(level, subjectId).all()).results || [];
    return rows.map(summary);
  }
  async listMine(ownerId) {
    const rows = (await this.db.prepare("SELECT * FROM quiz_bank_catalog WHERE author_id=?1 AND status='published' ORDER BY updated_at DESC LIMIT 100").bind(ownerId).all()).results || [];
    return rows.map(summary);
  }
  async publish({ ownerId, sourceType = 'class', classId, quizId, level, subjectId, tags, license, now = new Date().toISOString() }) {
    let quiz;
    if (sourceType === 'general') quiz = await this.generalQuizRepository.item(ownerId, quizId);
    else {
      await this.quizRepository.owner(classId, ownerId);
      quiz = await this.quizRepository.item(classId, quizId);
    }
    if (quiz.owner_id !== ownerId) throw forbidden('Hanya pembuat kuis yang dapat menerbitkannya ke Bank Kuis.');
    if (quiz.status !== 'published') throw forbidden('Terbitkan kuis terlebih dahulu.');
    const questions = parse(quiz.questions_json, []);
    const snapshot = { title: quiz.title, description: quiz.description || '', status: 'draft', mode: 'self_paced', questions, settings: parse(quiz.settings_json, {}) };
    const id = crypto.randomUUID();
    await this.db.prepare("INSERT INTO quiz_bank_catalog(id,author_id,source_type,source_class_id,source_quiz_id,status,title,description,question_count,total_points,level,subject_id,tags_json,license,snapshot_json,published_at,updated_at) VALUES(?1,?2,?3,?4,?5,'published',?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15) ON CONFLICT(author_id,source_type,source_quiz_id) DO UPDATE SET status='published',source_class_id=excluded.source_class_id,title=excluded.title,description=excluded.description,question_count=excluded.question_count,total_points=excluded.total_points,level=excluded.level,subject_id=excluded.subject_id,tags_json=excluded.tags_json,license=excluded.license,snapshot_json=excluded.snapshot_json,updated_at=excluded.updated_at").bind(id, ownerId, sourceType, sourceType === 'class' ? classId : null, quizId, quiz.title, quiz.description || '', questions.length, questions.reduce((total, question) => total + question.points, 0), level, subjectId, JSON.stringify(tags), license, JSON.stringify(snapshot), now).run();
    const published = await this.db.prepare('SELECT * FROM quiz_bank_catalog WHERE author_id=?1 AND source_type=?2 AND source_quiz_id=?3').bind(ownerId, sourceType, quizId).first();
    return summary(published);
  }
  async copyToClass({ catalogId, classId, ownerId }) {
    const catalog = await this.catalog(catalogId);
    const snapshot = parse(catalog.snapshot_json, {});
    const quiz = await this.quizRepository.create({ classId, ownerId, ...snapshot, status: 'draft' });
    return { ...quiz, copiedFrom: summary(catalog) };
  }
  async unpublish({ catalogId, ownerId }) {
    const catalog = await this.catalog(catalogId);
    if (catalog.author_id !== ownerId) throw forbidden('Hanya pembuat kuis yang dapat menarik publikasi ini.');
    await this.db.prepare("UPDATE quiz_bank_catalog SET status='unpublished',updated_at=?3 WHERE id=?1 AND author_id=?2").bind(catalogId, ownerId, new Date().toISOString()).run();
  }
}
