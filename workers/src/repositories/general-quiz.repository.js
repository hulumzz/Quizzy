import { forbidden, notFound } from '../http/errors.js';

const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const summary = (row) => {
  const questions = parse(row.questions_json, []);
  return { id: row.id, ownerId: row.owner_id, scope: 'general', title: row.title, description: row.description || '',
    status: row.status, mode: row.mode, questionCount: questions.length,
    totalPoints: questions.reduce((total, question) => total + question.points, 0),
    settings: parse(row.settings_json, {}), createdAt: row.created_at, updatedAt: row.updated_at,
    publishedAt: row.published_at || null };
};

export class GeneralQuizRepository {
  constructor(db) { this.db = db; }
  async item(ownerId, quizId) {
    const row = await this.db.prepare("SELECT * FROM general_quizzes WHERE owner_id=?1 AND id=?2 AND status<>'deleted'").bind(ownerId, quizId).first();
    if (!row) throw notFound('Kuis umum tidak ditemukan.');
    return row;
  }
  async list(ownerId) {
    const rows = (await this.db.prepare("SELECT * FROM general_quizzes WHERE owner_id=?1 AND status<>'deleted' ORDER BY updated_at DESC LIMIT 100").bind(ownerId).all()).results || [];
    return rows.map(summary);
  }
  async get(ownerId, quizId) {
    const row = await this.item(ownerId, quizId);
    return { ...summary(row), questions: parse(row.questions_json, []), accessRole: 'owner' };
  }
  async create({ ownerId, title, description, status, mode, questions, settings, now = new Date().toISOString() }) {
    const id = crypto.randomUUID();
    await this.db.prepare('INSERT INTO general_quizzes(id,owner_id,title,description,status,mode,questions_json,settings_json,published_at,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)').bind(id, ownerId, title, description, status, mode, JSON.stringify(questions), JSON.stringify(settings), status === 'published' ? now : null, now).run();
    return this.get(ownerId, id);
  }
  async update({ ownerId, quizId, title, description, status, mode, questions, settings, now = new Date().toISOString() }) {
    const current = await this.item(ownerId, quizId);
    if (current.owner_id !== ownerId) throw forbidden('Hanya pembuat kuis yang dapat mengubahnya.');
    await this.db.prepare("UPDATE general_quizzes SET title=?3,description=?4,status=?5,mode=?6,questions_json=?7,settings_json=?8,published_at=?9,updated_at=?10 WHERE owner_id=?1 AND id=?2 AND status<>'deleted'").bind(ownerId, quizId, title, description, status, mode, JSON.stringify(questions), JSON.stringify(settings), status === 'published' ? current.published_at || now : null, now).run();
    return this.get(ownerId, quizId);
  }
  async remove(ownerId, quizId, now = new Date().toISOString()) {
    await this.item(ownerId, quizId);
    await this.db.prepare("UPDATE general_quizzes SET status='deleted',deleted_at=?3,updated_at=?3 WHERE owner_id=?1 AND id=?2").bind(ownerId, quizId, now).run();
  }
}
