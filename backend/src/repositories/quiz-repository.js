import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { conflict, forbidden, notFound } from '../http/errors.js';

const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('id-ID');
const summary = (item) => ({ id: item.id, classId: item.classId, title: item.title, description: item.description || '', status: item.status, mode: item.mode, questionCount: item.questions?.length || 0, totalPoints: (item.questions || []).reduce((sum, q) => sum + q.points, 0), settings: item.settings, createdAt: item.createdAt, updatedAt: item.updatedAt, publishedAt: item.publishedAt || null });
const safeQuestion = (question) => ({
  id: question.id, type: question.type, prompt: question.prompt, choices: question.choices, points: question.points,
  ...(question.type === 'arrange' ? { items: question.items } : {}),
  ...(question.type === 'image_hotspot' ? { imageUrl: question.imageUrl, tolerancePercent: question.tolerancePercent, hotspots: (question.hotspots || []).map(({ id, label, x, y, width, height }) => ({ id, label, x, y, width, height })) } : {}),
});
const safeDetail = (item) => ({ ...summary(item), questions: (item.questions || []).map(safeQuestion) });

function equalOrder(supplied, correctOrder) {
  return Array.isArray(supplied) && supplied.length === correctOrder.length && supplied.every((value, index) => value === correctOrder[index]);
}

function hotspotHit(supplied, question) {
  if (!supplied || typeof supplied !== 'object' || !Number.isFinite(supplied.x) || !Number.isFinite(supplied.y)) return false;
  const area = (question.hotspots || []).find((spot) => spot.correct);
  if (!area) return false;
  const margin = Number(question.tolerancePercent || 0);
  return supplied.x >= area.x - margin && supplied.x <= area.x + area.width + margin && supplied.y >= area.y - margin && supplied.y <= area.y + area.height + margin;
}

function isCorrectAnswer(question, supplied) {
  if (question.type === 'true_false') return supplied === question.correctAnswer;
  if (question.type === 'arrange') return equalOrder(supplied, question.correctOrder);
  if (question.type === 'image_hotspot') return hotspotHit(supplied, question);
  return normalize(supplied) === normalize(question.correctAnswer);
}

export class QuizRepository {
  constructor({ tableName = process.env.TABLE_NAME, documentClient, classRepository } = {}) {
    if (!tableName) throw new Error('TABLE_NAME is required');
    if (!classRepository) throw new Error('classRepository is required');
    this.tableName = tableName;
    this.classRepository = classRepository;
    this.client = documentClient || DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  }

  async access(classId, uid) { return this.classRepository.getForUser(classId, uid); }
  async requireOwner(classId, uid) {
    const access = await this.access(classId, uid);
    if (access.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat mengubah kuis.');
    return access;
  }
  async getItem(classId, quizId) {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK: `CLASS#${classId}`, SK: `QUIZ#${quizId}` }, ConsistentRead: true }));
    if (!result.Item || result.Item.status === 'deleted') throw notFound('Kuis tidak ditemukan.');
    return result.Item;
  }
  async list(classId, uid) {
    const access = await this.access(classId, uid);
    const result = await this.client.send(new QueryCommand({ TableName: this.tableName, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)', ExpressionAttributeValues: { ':pk': `CLASS#${classId}`, ':sk': 'QUIZ#' }, ScanIndexForward: false, Limit: 100 }));
    return (result.Items || []).filter((item) => item.status !== 'deleted' && (access.accessRole === 'owner' || item.status === 'published')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summary);
  }
  async get(classId, quizId, uid) {
    const access = await this.access(classId, uid);
    const item = await this.getItem(classId, quizId);
    if (access.accessRole !== 'owner' && item.status !== 'published') throw notFound('Kuis tidak ditemukan.');
    return access.accessRole === 'owner' ? { ...summary(item), questions: item.questions, accessRole: 'owner' } : { ...safeDetail(item), accessRole: 'member' };
  }
  async exportForOwner(classId, quizId, ownerId, exportedAt = new Date().toISOString()) {
    await this.requireOwner(classId, ownerId);
    const quiz = await this.getItem(classId, quizId);
    if (quiz.ownerId !== ownerId) throw forbidden('Hanya pembuat kuis yang dapat mengunduhnya.');
    return {
      format: 'quizzy-quiz/v1',
      exportedAt,
      quiz: {
        title: quiz.title,
        description: quiz.description || '',
        status: 'draft',
        mode: 'self_paced',
        questions: quiz.questions,
        settings: quiz.settings,
      },
    };
  }
  async create({ classId, ownerId, now = new Date().toISOString(), ...input }) {
    await this.requireOwner(classId, ownerId);
    const id = randomUUID();
    const item = { PK: `CLASS#${classId}`, SK: `QUIZ#${id}`, entityType: 'QUIZ', id, classId, ownerId, ...input, createdAt: now, updatedAt: now, ...(input.status === 'published' ? { publishedAt: now } : {}) };
    await this.client.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: this.tableName, Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
      { Update: { TableName: this.tableName, Key: { PK: `CLASS#${classId}`, SK: 'META' }, UpdateExpression: 'SET updatedAt = :now ADD quizzesCount :one', ConditionExpression: 'ownerId = :owner', ExpressionAttributeValues: { ':now': now, ':one': 1, ':owner': ownerId } } },
    ] }));
    return { ...summary(item), questions: item.questions, accessRole: 'owner' };
  }
  async update({ classId, quizId, ownerId, now = new Date().toISOString(), ...input }) {
    await this.requireOwner(classId, ownerId);
    const current = await this.getItem(classId, quizId);
    const item = { ...current, ...input, updatedAt: now, ...(input.status === 'published' ? { publishedAt: current.publishedAt || now } : {}) };
    if (input.status !== 'published') delete item.publishedAt;
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item, ConditionExpression: 'ownerId = :owner AND attribute_exists(PK)', ExpressionAttributeValues: { ':owner': ownerId } }));
    return { ...summary(item), questions: item.questions, accessRole: 'owner' };
  }
  async remove(classId, quizId, ownerId, now = new Date().toISOString()) {
    await this.requireOwner(classId, ownerId);
    await this.getItem(classId, quizId);
    await this.client.send(new TransactWriteCommand({ TransactItems: [
      { Update: { TableName: this.tableName, Key: { PK: `CLASS#${classId}`, SK: `QUIZ#${quizId}` }, UpdateExpression: 'SET #status = :deleted, deletedAt = :now, updatedAt = :now', ConditionExpression: 'ownerId = :owner', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':deleted': 'deleted', ':now': now, ':owner': ownerId } } },
      { Update: { TableName: this.tableName, Key: { PK: `CLASS#${classId}`, SK: 'META' }, UpdateExpression: 'SET updatedAt = :now ADD quizzesCount :minus', ConditionExpression: 'ownerId = :owner AND quizzesCount > :zero', ExpressionAttributeValues: { ':now': now, ':minus': -1, ':zero': 0, ':owner': ownerId } } },
    ] }));
  }
  async submit({ classId, quizId, uid, answers, now = new Date().toISOString() }) {
    const access = await this.access(classId, uid);
    if (access.accessRole !== 'member') throw forbidden('Percobaan kuis hanya tersedia untuk siswa kelas.');
    const quiz = await this.getItem(classId, quizId);
    if (quiz.status !== 'published') throw notFound('Kuis tidak ditemukan.');
    const answerMap = new Map(answers.map((item) => [item.questionId, item.answer]));
    const totalPoints = quiz.questions.reduce((sum, question) => sum + question.points, 0);
    const earnedPoints = quiz.questions.reduce((sum, question) => {
      const supplied = answerMap.get(question.id);
      const correct = isCorrectAnswer(question, supplied);
      return sum + (correct ? question.points : 0);
    }, 0);
    const score = totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const item = { PK: `QUIZ#${quizId}`, SK: `ATTEMPT#${uid}`, entityType: 'QUIZ_ATTEMPT', id: randomUUID(), quizId, classId, studentId: uid, answers, score, earnedPoints, totalPoints, passed: score >= quiz.settings.passingScore, submittedAt: now };
    try {
      await this.client.send(new PutCommand({ TableName: this.tableName, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') throw conflict('QUIZ_ALREADY_SUBMITTED', 'Kuis ini sudah pernah dikumpulkan.');
      throw error;
    }
    return this.result(item, quiz);
  }
  result(attempt, quiz) {
    const response = { id: attempt.id, quizId: attempt.quizId, classId: attempt.classId, score: attempt.score, earnedPoints: attempt.earnedPoints, totalPoints: attempt.totalPoints, passed: attempt.passed, submittedAt: attempt.submittedAt };
    if (quiz.settings.showCorrectAnswers) response.review = quiz.questions.map((question) => ({ questionId: question.id, prompt: question.prompt, answer: attempt.answers.find((a) => a.questionId === question.id)?.answer ?? '', correctAnswer: question.correctAnswer, explanation: question.explanation || '' }));
    return response;
  }
  async getResult(classId, quizId, uid) {
    const access = await this.access(classId, uid);
    const quiz = await this.getItem(classId, quizId);
    if (access.accessRole === 'owner') return this.listResults(classId, quizId, uid);
    const found = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK: `QUIZ#${quizId}`, SK: `ATTEMPT#${uid}` }, ConsistentRead: true }));
    if (!found.Item) throw notFound('Hasil kuis belum tersedia.');
    return this.result(found.Item, quiz);
  }
  async listResults(classId, quizId, uid) {
    await this.requireOwner(classId, uid);
    await this.getItem(classId, quizId);
    const result = await this.client.send(new QueryCommand({ TableName: this.tableName, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)', ExpressionAttributeValues: { ':pk': `QUIZ#${quizId}`, ':sk': 'ATTEMPT#' }, Limit: 100 }));
    return (result.Items || []).map((item) => ({ id: item.id, quizId: item.quizId, classId: item.classId, studentId: item.studentId, score: item.score, earnedPoints: item.earnedPoints, totalPoints: item.totalPoints, passed: item.passed, submittedAt: item.submittedAt })).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }
}
