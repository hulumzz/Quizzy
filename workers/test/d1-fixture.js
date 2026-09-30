import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrations = fileURLToPath(new URL('../migrations/', import.meta.url));

export function createD1Fixture() {
  const sqlite = new DatabaseSync(':memory:');
  for (const filename of readdirSync(migrations).filter((name) => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(`../migrations/${filename}`, import.meta.url), 'utf8'));
  }
  const wrap = (query, values = []) => ({
    bind(...next) { return wrap(query, next); },
    async first() { return sqlite.prepare(query).get(...values) || null; },
    async all() { return { results: sqlite.prepare(query).all(...values) }; },
    async run() { const result = sqlite.prepare(query).run(...values); return { meta: { changes: Number(result.changes) } }; },
  });
  const db = {
    prepare(query) { return wrap(query); },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const now = '2026-09-30T00:00:00.000Z';
  sqlite.prepare('INSERT INTO users(id,name,role,created_at,updated_at) VALUES(?1,?2,?3,?4,?4)').run('teacher-1', 'Guru', 'teacher', now);
  sqlite.prepare('INSERT INTO users(id,name,role,created_at,updated_at) VALUES(?1,?2,?3,?4,?4)').run('student-1', 'Siswa', 'student', now);
  sqlite.prepare("INSERT INTO classes(id,code,owner_id,teacher_name,name,description,status,created_at,updated_at) VALUES(?1,'ABC123',?2,'Guru','Kelas 1','','active',?3,?3)").run('class-1', 'teacher-1', now);
  sqlite.prepare("INSERT INTO class_members(class_id,user_id,name,role,joined_at) VALUES('class-1','student-1','Siswa','student',?1)").run(now);
  return { db, sqlite, close: () => sqlite.close() };
}
