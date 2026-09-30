import { conflict, forbidden, notFound, HttpError } from '../http/errors.js';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function createClassCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

function publicClass(row, extra = {}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || '',
    teacherName: row.teacher_name || '',
    status: row.status,
    studentsCount: Number(row.students_count || 0),
    materialsCount: Number(row.materials_count || 0),
    quizzesCount: Number(row.quizzes_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...extra,
  };
}

function publicMember(row) { return { uid: row.user_id, name: row.name || 'Siswa Quizzy', joinedAt: row.joined_at }; }

export class ClassRepository {
  constructor(db) {
    if (!db) throw new Error('D1 binding DB is required');
    this.db = db;
  }

  async listOwnedBy(ownerId) {
    const result = await this.db.prepare('SELECT * FROM classes WHERE owner_id = ?1 ORDER BY created_at DESC LIMIT 50').bind(ownerId).all();
    return (result.results || []).map((row) => publicClass(row, { accessRole: 'owner' }));
  }

  async listJoinedBy(uid) {
    const result = await this.db.prepare(`SELECT c.*, m.joined_at
      FROM class_members m JOIN classes c ON c.id = m.class_id
      WHERE m.user_id = ?1 ORDER BY m.joined_at DESC LIMIT 50`).bind(uid).all();
    return (result.results || []).map((row) => publicClass(row, { accessRole: 'member', joinedAt: row.joined_at }));
  }

  async ensureUser({ id, name, role, now }) {
    await this.db.prepare(`INSERT INTO users (id, name, role, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?4)
      ON CONFLICT(id) DO UPDATE SET name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE users.name END, updated_at = excluded.updated_at`).bind(
      id, name || '', role, now,
    ).run();
  }

  async create({ ownerId, teacherName, name, description, now = new Date().toISOString() }) {
    await this.ensureUser({ id: ownerId, name: teacherName, role: 'teacher', now });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const row = {
        id: crypto.randomUUID(), code: createClassCode(), ownerId, teacherName, name, description, now,
      };
      try {
        await this.db.prepare(`INSERT INTO classes (
          id, code, owner_id, teacher_name, name, description, status, students_count, materials_count, quizzes_count, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', 0, 0, 0, ?7, ?7)`).bind(
          row.id, row.code, row.ownerId, row.teacherName, row.name, row.description, row.now,
        ).run();
        return publicClass({ ...row, teacher_name: row.teacherName, created_at: now, updated_at: now, status: 'active' });
      } catch (error) {
        if (!/unique|constraint/i.test(String(error?.message || ''))) throw error;
      }
    }
    throw new HttpError(409, 'CLASS_CODE_CONFLICT', 'Kode kelas belum dapat dibuat. Silakan coba lagi.');
  }

  async joinByCode({ uid, name, code, idempotencyKey: _idempotencyKey, now = new Date().toISOString() }) {
    const classItem = await this.db.prepare('SELECT * FROM classes WHERE code = ?1').bind(code).first();
    if (!classItem) throw notFound('Kelas dengan kode tersebut tidak ditemukan.');
    if (classItem.owner_id === uid) throw conflict('CLASS_OWNER_CANNOT_JOIN', 'Anda sudah menjadi pengelola kelas ini.');
    if (classItem.status !== 'active') throw conflict('CLASS_NOT_ACTIVE', 'Kelas ini sedang tidak menerima anggota.');
    await this.ensureUser({ id: uid, name, role: 'student', now });
    const insert = await this.db.prepare(`INSERT INTO class_members (class_id, user_id, name, role, joined_at)
      VALUES (?1, ?2, ?3, 'student', ?4) ON CONFLICT(class_id, user_id) DO NOTHING`).bind(classItem.id, uid, name || 'Siswa Quizzy', now).run();
    const membership = await this.db.prepare('SELECT joined_at FROM class_members WHERE class_id = ?1 AND user_id = ?2').bind(classItem.id, uid).first();
    if (!membership) throw new HttpError(503, 'CLASS_JOIN_UNAVAILABLE', 'Kelas belum dapat diikuti. Silakan coba lagi.');
    if (insert.meta.changes) {
      await this.db.prepare('UPDATE classes SET students_count = students_count + 1, updated_at = ?2 WHERE id = ?1').bind(classItem.id, now).run();
    }
    const refreshed = await this.db.prepare('SELECT * FROM classes WHERE id = ?1').bind(classItem.id).first();
    return publicClass(refreshed || classItem, { accessRole: 'member', joinedAt: membership.joined_at });
  }

  async getForUser(classId, uid) {
    const classItem = await this.db.prepare('SELECT * FROM classes WHERE id = ?1').bind(classId).first();
    if (!classItem) throw notFound('Kelas tidak ditemukan.');
    if (classItem.owner_id === uid) return publicClass(classItem, { accessRole: 'owner' });
    const membership = await this.db.prepare('SELECT joined_at FROM class_members WHERE class_id = ?1 AND user_id = ?2').bind(classId, uid).first();
    if (!membership) throw forbidden('Anda bukan anggota kelas ini.');
    return publicClass(classItem, { accessRole: 'member', joinedAt: membership.joined_at });
  }

  async listMembers(classId, ownerId) {
    const classItem = await this.db.prepare('SELECT owner_id FROM classes WHERE id = ?1').bind(classId).first();
    if (!classItem) throw notFound('Kelas tidak ditemukan.');
    if (classItem.owner_id !== ownerId) throw forbidden('Hanya pengelola kelas yang dapat melihat daftar anggota.');
    const result = await this.db.prepare('SELECT user_id, name, joined_at FROM class_members WHERE class_id = ?1 ORDER BY joined_at DESC LIMIT 100').bind(classId).all();
    return (result.results || []).map(publicMember);
  }
}
