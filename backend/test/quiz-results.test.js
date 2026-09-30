import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { QuizRepository } from '../src/repositories/quiz-repository.js';

test('teacher quiz results expose the stored class member name instead of a Firebase uid', async () => {
  const repository = new QuizRepository({
    tableName: 'QuizzyTable',
    classRepository: { async getForUser() { return { accessRole: 'owner' }; }, async listMembers() { return [{ uid: 'student-1', name: 'Ayu Pratiwi' }]; } },
    documentClient: { async send(command) { if (command instanceof QueryCommand) return { Items: [{ id: 'attempt-1', quizId: 'quiz-1', classId: 'class-1', studentId: 'student-1', score: 90, earnedPoints: 9, totalPoints: 10, passed: true, submittedAt: '2026-09-29T00:00:00.000Z' }] }; return { Item: { id: 'quiz-1', status: 'published' } }; } },
  });
  repository.getItem = async () => ({ id: 'quiz-1' });
  const results = await repository.listResults('class-1', 'quiz-1', 'teacher-1');
  assert.equal(results[0].studentName, 'Ayu Pratiwi');
  assert.equal(results[0].studentId, 'student-1');
});
