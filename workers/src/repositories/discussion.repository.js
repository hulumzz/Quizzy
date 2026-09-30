import { forbidden, notFound } from '../http/errors.js';

function publicMessage(row, uid) { return { id: row.id, content: row.deleted_at ? '' : row.content, author: { name: row.author_name, role: row.author_role }, canEdit: !row.deleted_at && row.author_id === uid, deleted: Boolean(row.deleted_at), createdAt: row.created_at, updatedAt: row.updated_at, editedAt: row.edited_at || null }; }
function discussion(row, replies, uid) { return { ...publicMessage(row, uid), status: row.status || 'open', answerId: row.answer_id || null, replies: replies.map((reply) => ({ ...publicMessage(reply, uid), discussionId: row.id, isAnswer: row.answer_id === reply.id })) }; }

export class DiscussionRepository {
  constructor({ db, materialRepository }) { this.db = db; this.materialRepository = materialRepository; }
  async access(classId, materialId, uid) { return this.materialRepository.get(classId, materialId, uid); }
  async root(materialId, id, { includeDeleted = false } = {}) { const row = await this.db.prepare('SELECT * FROM discussions WHERE material_id = ?1 AND id = ?2').bind(materialId, id).first(); if (!row || (!includeDeleted && row.deleted_at)) throw notFound('Diskusi tidak ditemukan.'); return row; }
  async replyRow(discussionId, id) { const row = await this.db.prepare('SELECT * FROM discussion_replies WHERE discussion_id = ?1 AND id = ?2').bind(discussionId, id).first(); if (!row) throw notFound('Pesan diskusi tidak ditemukan.'); return row; }
  async list(classId, materialId, uid) {
    const material = await this.access(classId, materialId, uid);
    const [roots, replies] = await this.db.batch([
      this.db.prepare('SELECT * FROM discussions WHERE material_id = ?1 ORDER BY created_at DESC LIMIT 100').bind(materialId),
      this.db.prepare('SELECT r.* FROM discussion_replies r JOIN discussions d ON d.id = r.discussion_id WHERE d.material_id = ?1 ORDER BY r.created_at ASC LIMIT 500').bind(materialId),
    ]);
    const grouped = new Map(); for (const row of replies.results || []) grouped.set(row.discussion_id, [...(grouped.get(row.discussion_id) || []), row]);
    return { material: { id: material.id, classId: material.classId, title: material.title, status: material.status }, canResolve: material.accessRole === 'owner', discussions: (roots.results || []).map((row) => discussion(row, grouped.get(row.id) || [], uid)) };
  }
  async create({ classId, materialId, uid, authorName, content, now = new Date().toISOString() }) {
    const material = await this.access(classId, materialId, uid); const id = crypto.randomUUID(); const role = material.accessRole === 'owner' ? 'teacher' : 'student';
    await this.db.prepare(`INSERT INTO discussions (id, class_id, material_id, author_id, author_name, author_role, content, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'open', ?8, ?8)`).bind(id, classId, materialId, uid, authorName, role, content, now).run();
    return discussion({ id, class_id: classId, material_id: materialId, author_id: uid, author_name: authorName, author_role: role, content, status: 'open', created_at: now, updated_at: now }, [], uid);
  }
  async reply({ classId, materialId, discussionId, uid, authorName, content, now = new Date().toISOString() }) {
    const material = await this.access(classId, materialId, uid); await this.root(materialId, discussionId); const id = crypto.randomUUID(); const role = material.accessRole === 'owner' ? 'teacher' : 'student';
    await this.db.prepare(`INSERT INTO discussion_replies (id, discussion_id, class_id, material_id, author_id, author_name, author_role, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`).bind(id, discussionId, classId, materialId, uid, authorName, role, content, now).run();
    return { ...publicMessage({ id, author_id: uid, author_name: authorName, author_role: role, content, created_at: now, updated_at: now }, uid), discussionId, isAnswer: false };
  }
  async update({ classId, materialId, discussionId, replyId, uid, content, now = new Date().toISOString() }) {
    await this.access(classId, materialId, uid); const row = replyId ? await this.replyRow(discussionId, replyId) : await this.root(materialId, discussionId); if (row.author_id !== uid) throw forbidden('Anda hanya dapat mengedit pesan sendiri.'); if (row.deleted_at) throw notFound('Pesan diskusi tidak ditemukan.');
    const table = replyId ? 'discussion_replies' : 'discussions'; await this.db.prepare(`UPDATE ${table} SET content = ?3, edited_at = ?4, updated_at = ?4 WHERE id = ?1 AND author_id = ?2 AND deleted_at IS NULL`).bind(row.id, uid, content, now).run();
    const updated = { ...row, content, edited_at: now, updated_at: now }; return replyId ? { ...publicMessage(updated, uid), discussionId, isAnswer: false } : discussion(updated, [], uid);
  }
  async remove({ classId, materialId, discussionId, replyId, uid, now = new Date().toISOString() }) {
    await this.access(classId, materialId, uid); const row = replyId ? await this.replyRow(discussionId, replyId) : await this.root(materialId, discussionId, { includeDeleted: true }); if (row.author_id !== uid) throw forbidden('Anda hanya dapat menghapus pesan sendiri.'); if (row.deleted_at) return;
    const table = replyId ? 'discussion_replies' : 'discussions'; const statements = [this.db.prepare(`UPDATE ${table} SET content = NULL, deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND author_id = ?3`).bind(row.id, now, uid)];
    if (replyId) statements.push(this.db.prepare("UPDATE discussions SET status = 'open', answer_id = NULL, resolved_at = NULL, resolved_by = NULL, updated_at = ?2 WHERE id = ?1 AND answer_id = ?3").bind(discussionId, now, replyId));
    await this.db.batch(statements);
  }
  async setStatus({ classId, materialId, discussionId, uid, status, answerId, now = new Date().toISOString() }) {
    const material = await this.access(classId, materialId, uid); if (material.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat menandai jawaban.'); await this.root(materialId, discussionId);
    if (answerId) { const answer = await this.replyRow(discussionId, answerId); if (answer.deleted_at) throw notFound('Jawaban tidak ditemukan.'); }
    await this.db.prepare('UPDATE discussions SET status = ?2, answer_id = ?3, resolved_at = ?4, resolved_by = ?5, updated_at = ?4 WHERE id = ?1').bind(discussionId, status, answerId || null, status === 'resolved' ? now : null, status === 'resolved' ? uid : null).run();
    return { status, answerId: answerId || null };
  }
}
