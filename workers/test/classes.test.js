import assert from 'node:assert/strict';
import test from 'node:test';
import { ClassRepository } from '../src/repositories/class.repository.js';
import { validateCreateClass, validateJoinClass } from '../src/validation/classes.js';

test('class validation retains the API contract limits and code normalization', () => {
  assert.deepEqual(validateCreateClass({ name: '  Fisika   Dasar ', description: 'Gelombang' }), { name: 'Fisika Dasar', description: 'Gelombang' });
  assert.deepEqual(validateJoinClass({ code: ' abc234 ' }), { code: 'ABC234' });
  assert.throws(() => validateCreateClass({ name: 'A' }), (error) => error.code === 'VALIDATION_ERROR');
  assert.throws(() => validateJoinClass({ code: 'invalid' }), (error) => error.code === 'VALIDATION_ERROR');
});

test('class repository scopes the owner query and preserves its public response shape', async () => {
  let statement;
  const db = { prepare(sql) {
    statement = { sql, values: [] };
    return { bind(...values) { statement.values = values; return this; }, async all() { return { results: [{ id: 'class-1', code: 'ABC234', name: 'Kimia', description: '', teacher_name: 'Pak Ari', status: 'active', students_count: 2, materials_count: 1, quizzes_count: 3, created_at: '2026-09-30T00:00:00.000Z', updated_at: '2026-09-30T00:00:00.000Z' }] }; } };
  } };
  const classes = await new ClassRepository(db).listOwnedBy('teacher-1');
  assert.match(statement.sql, /WHERE owner_id = \?1/);
  assert.deepEqual(statement.values, ['teacher-1']);
  assert.deepEqual(classes[0], { id: 'class-1', code: 'ABC234', name: 'Kimia', description: '', teacherName: 'Pak Ari', status: 'active', studentsCount: 2, materialsCount: 1, quizzesCount: 3, createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z', accessRole: 'owner' });
});
