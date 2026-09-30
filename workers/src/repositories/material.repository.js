import { forbidden, notFound } from '../http/errors.js';

function parseBlocks(value) { try { return JSON.parse(value || '[]'); } catch { return []; } }
function summary(row, extra = {}) {
  return { id: row.id, classId: row.class_id, title: row.title, summary: row.summary || '', status: row.status, sessionId: row.session_id || null, blocksCount: parseBlocks(row.blocks_json).length, createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at || null, ...extra };
}
function detail(row, extra = {}) { return { ...summary(row), blocks: parseBlocks(row.blocks_json), ...extra }; }

export class MaterialRepository {
  constructor({ db, classRepository, learningSessionRepository }) { if (!db || !classRepository) throw new Error('DB and classRepository are required'); this.db = db; this.classRepository = classRepository; this.learningSessionRepository = learningSessionRepository; }
  async access(classId, uid) { return this.classRepository.getForUser(classId, uid); }
  async requireOwner(classId, uid) { const access = await this.access(classId, uid); if (access.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat mengubah materi.'); return access; }
  async getItem(classId, materialId) { const item = await this.db.prepare('SELECT * FROM materials WHERE class_id = ?1 AND id = ?2 AND status <> \'deleted\'').bind(classId, materialId).first(); if (!item) throw notFound('Materi tidak ditemukan.'); return item; }
  async learningState(uid, classId, materialId) {
    const [progress, bookmark] = await this.db.batch([
      this.db.prepare('SELECT percent, status, last_read_at, completed_at FROM material_progress WHERE class_id = ?1 AND material_id = ?2 AND user_id = ?3').bind(classId, materialId, uid),
      this.db.prepare('SELECT 1 AS saved FROM material_bookmarks WHERE class_id = ?1 AND material_id = ?2 AND user_id = ?3').bind(classId, materialId, uid),
    ]);
    const value = progress.results?.[0];
    return { progress: value ? { percent: value.percent, status: value.status, lastReadAt: value.last_read_at, completedAt: value.completed_at || null } : null, bookmarked: Boolean(bookmark.results?.[0]) };
  }
  async list(classId, uid) {
    const access = await this.access(classId, uid);
    const query = access.accessRole === 'owner' ? 'SELECT * FROM materials WHERE class_id = ?1 AND status <> \'deleted\' ORDER BY updated_at DESC LIMIT 100' : 'SELECT * FROM materials WHERE class_id = ?1 AND status = \'published\' ORDER BY updated_at DESC LIMIT 100';
    const rows = (await this.db.prepare(query).bind(classId).all()).results || [];
    if (access.accessRole === 'owner') return rows.map((row) => summary(row));
    const states = await Promise.all(rows.map((row) => this.learningState(uid, classId, row.id)));
    return rows.map((row, index) => summary(row, states[index]));
  }
  async get(classId, materialId, uid) {
    const access = await this.access(classId, uid); const item = await this.getItem(classId, materialId);
    if (access.accessRole !== 'owner' && item.status !== 'published') throw notFound('Materi tidak ditemukan.');
    return detail(item, access.accessRole === 'owner' ? { accessRole: 'owner' } : { accessRole: 'member', ...(await this.learningState(uid, classId, materialId)) });
  }
  async create({ classId, ownerId, title, summary: materialSummary, status, blocks, sessionId, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId); if (sessionId) await this.learningSessionRepository.requireAssignable(classId, sessionId, ownerId);
    const id = crypto.randomUUID(); const blocksJson = JSON.stringify(blocks);
    await this.db.batch([
      this.db.prepare(`INSERT INTO materials (id, class_id, owner_id, title, summary, status, blocks_json, session_id, published_at, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`).bind(id, classId, ownerId, title, materialSummary, status, blocksJson, sessionId || null, status === 'published' ? now : null, now),
      this.db.prepare('UPDATE classes SET materials_count = materials_count + 1, updated_at = ?2 WHERE id = ?1 AND owner_id = ?3').bind(classId, now, ownerId),
    ]);
    return detail({ id, class_id: classId, title, summary: materialSummary, status, blocks_json: blocksJson, session_id: sessionId, created_at: now, updated_at: now, published_at: status === 'published' ? now : null }, { accessRole: 'owner' });
  }
  async update({ classId, materialId, ownerId, title, summary: materialSummary, status, blocks, sessionId, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId); if (sessionId) await this.learningSessionRepository.requireAssignable(classId, sessionId, ownerId); const current = await this.getItem(classId, materialId); const blocksJson = JSON.stringify(blocks); const publishedAt = status === 'published' ? (current.published_at || now) : null;
    await this.db.prepare(`UPDATE materials SET title = ?3, summary = ?4, status = ?5, blocks_json = ?6, session_id = ?7, published_at = ?8, updated_at = ?9
      WHERE class_id = ?1 AND id = ?2 AND owner_id = ?10 AND status <> 'deleted'`).bind(classId, materialId, title, materialSummary, status, blocksJson, sessionId || null, publishedAt, now, ownerId).run();
    return detail({ ...current, title, summary: materialSummary, status, blocks_json: blocksJson, session_id: sessionId, published_at: publishedAt, updated_at: now }, { accessRole: 'owner' });
  }
  async remove(classId, materialId, ownerId, now = new Date().toISOString()) {
    await this.requireOwner(classId, ownerId); await this.getItem(classId, materialId);
    await this.db.batch([
      this.db.prepare("UPDATE materials SET status = 'deleted', deleted_at = ?3, updated_at = ?3 WHERE class_id = ?1 AND id = ?2 AND owner_id = ?4").bind(classId, materialId, now, ownerId),
      this.db.prepare('UPDATE classes SET materials_count = CASE WHEN materials_count > 0 THEN materials_count - 1 ELSE 0 END, updated_at = ?2 WHERE id = ?1 AND owner_id = ?3').bind(classId, now, ownerId),
    ]);
  }
  async setProgress({ classId, materialId, uid, percent, now = new Date().toISOString() }) {
    const access = await this.access(classId, uid); if (access.accessRole !== 'member') throw forbidden('Progres belajar hanya tersedia untuk anggota kelas.');
    const material = await this.getItem(classId, materialId); if (material.status !== 'published') throw notFound('Materi tidak ditemukan.');
    const status = percent === 100 ? 'completed' : 'started';
    await this.db.prepare(`INSERT INTO material_progress (class_id, material_id, user_id, percent, status, last_read_at, completed_at, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?6, ?6)
      ON CONFLICT(class_id, material_id, user_id) DO UPDATE SET percent = excluded.percent, status = excluded.status, last_read_at = excluded.last_read_at, completed_at = excluded.completed_at, updated_at = excluded.updated_at`).bind(classId, materialId, uid, percent, status, now, percent === 100 ? now : null).run();
    return { percent, status, lastReadAt: now, completedAt: percent === 100 ? now : null };
  }
  async setBookmark({ classId, materialId, uid, saved, now = new Date().toISOString() }) {
    const access = await this.access(classId, uid); if (access.accessRole !== 'member') throw forbidden('Materi tersimpan hanya tersedia untuk anggota kelas.');
    const material = await this.getItem(classId, materialId); if (material.status !== 'published') throw notFound('Materi tidak ditemukan.');
    if (saved) await this.db.prepare('INSERT INTO material_bookmarks (class_id, material_id, user_id, saved_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(class_id, material_id, user_id) DO NOTHING').bind(classId, materialId, uid, now).run();
    else await this.db.prepare('DELETE FROM material_bookmarks WHERE class_id = ?1 AND material_id = ?2 AND user_id = ?3').bind(classId, materialId, uid).run();
    return { bookmarked: saved };
  }
  async listUserState(uid, kind) {
    const query = kind === 'bookmarks'
      ? `SELECT m.*, b.saved_at FROM material_bookmarks b JOIN materials m ON m.id = b.material_id AND m.class_id = b.class_id WHERE b.user_id = ?1 AND m.status = 'published' ORDER BY b.saved_at DESC LIMIT 100`
      : `SELECT m.*, p.percent, p.status AS progress_status, p.last_read_at, p.completed_at FROM material_progress p JOIN materials m ON m.id = p.material_id AND m.class_id = p.class_id WHERE p.user_id = ?1 AND m.status = 'published' ORDER BY p.last_read_at DESC LIMIT 100`;
    const rows = (await this.db.prepare(query).bind(uid).all()).results || [];
    return rows.map((row) => summary(row, kind === 'bookmarks' ? { bookmarked: true, savedAt: row.saved_at } : { progress: { percent: row.percent, status: row.progress_status, lastReadAt: row.last_read_at, completedAt: row.completed_at || null } }));
  }
}
