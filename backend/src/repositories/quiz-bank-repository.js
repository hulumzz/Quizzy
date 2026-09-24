import { randomUUID } from 'node:crypto';
import { BatchGetCommand, DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { forbidden, notFound } from '../http/errors.js';
import { quizSubjectById } from '../domain/quiz-taxonomy.js';

const catalogKey = (id) => ({ PK: `QUIZ_BANK_CATALOG#${id}`, SK: 'META' });
const pointerKey = (ownerId, quizId) => ({ PK: `TEACHER#${ownerId}`, SK: `QUIZ_BANK_SOURCE#${quizId}` });
const listingKeys = (level, subjectId, publishedAt, id) => [...new Set([
  `QUIZ_BANK#ALL#ALL`, `QUIZ_BANK#${level}#ALL`, `QUIZ_BANK#ALL#${subjectId}`, `QUIZ_BANK#${level}#${subjectId}`,
])].map((PK) => ({ PK, SK: `PUBLISHED#${publishedAt}#${id}` }));
const summary = (item) => ({ id: item.id, title: item.title, description: item.description || '', questionCount: item.questionCount, totalPoints: item.totalPoints, level: item.level, subject: quizSubjectById(item.subjectId), subjectId: item.subjectId, tags: item.tags || [], license: item.license, authorId: item.authorId, sourceQuizId: item.sourceQuizId, publishedAt: item.publishedAt, updatedAt: item.updatedAt });

export class QuizBankRepository {
  constructor({ tableName = process.env.TABLE_NAME, documentClient, quizRepository } = {}) {
    if (!tableName) throw new Error('TABLE_NAME is required');
    if (!quizRepository) throw new Error('quizRepository is required');
    this.tableName = tableName;
    this.quizRepository = quizRepository;
    this.client = documentClient || DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  }

  async getCatalog(id) {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: catalogKey(id), ConsistentRead: true }));
    if (!result.Item || result.Item.status !== 'published') throw notFound('Kuis bank tidak ditemukan atau sudah ditarik.');
    return result.Item;
  }

  async list({ level, subjectId }) {
    const result = await this.client.send(new QueryCommand({ TableName: this.tableName, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': `QUIZ_BANK#${level}#${subjectId}`, ':prefix': 'PUBLISHED#' }, ScanIndexForward: false, Limit: 60 }));
    return (result.Items || []).map(summary);
  }

  async listMine(ownerId) {
    const pointers = await this.client.send(new QueryCommand({ TableName: this.tableName, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': `TEACHER#${ownerId}`, ':prefix': 'QUIZ_BANK_SOURCE#' }, Limit: 100 }));
    const keys = (pointers.Items || []).map((item) => catalogKey(item.catalogId));
    if (!keys.length) return [];
    const response = await this.client.send(new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: keys, ConsistentRead: true } } }));
    return (response.Responses?.[this.tableName] || []).filter((item) => item.status === 'published').map(summary).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async publish({ ownerId, classId, quizId, level, subjectId, tags, license, now = new Date().toISOString() }) {
    await this.quizRepository.requireOwner(classId, ownerId);
    const quiz = await this.quizRepository.getItem(classId, quizId);
    if (quiz.ownerId !== ownerId) throw forbidden('Hanya pembuat kuis yang dapat menerbitkannya ke Bank Kuis.');
    if (quiz.status !== 'published') throw forbidden('Terbitkan kuis kelas terlebih dahulu.');
    const pointer = await this.client.send(new GetCommand({ TableName: this.tableName, Key: pointerKey(ownerId, quizId), ConsistentRead: true }));
    const existing = pointer.Item?.catalogId ? await this.client.send(new GetCommand({ TableName: this.tableName, Key: catalogKey(pointer.Item.catalogId), ConsistentRead: true })) : null;
    const hasPointer = Boolean(pointer.Item?.catalogId);
    const id = existing?.Item?.id || pointer.Item?.catalogId || randomUUID(); const publishedAt = existing?.Item?.publishedAt || now;
    const snapshot = { title: quiz.title, description: quiz.description || '', status: 'draft', mode: 'self_paced', questions: quiz.questions, settings: quiz.settings };
    const item = { ...catalogKey(id), entityType: 'QUIZ_BANK_CATALOG', id, status: 'published', authorId: ownerId, sourceClassId: classId, sourceQuizId: quizId, title: quiz.title, description: quiz.description || '', questionCount: quiz.questions.length, totalPoints: quiz.questions.reduce((total, question) => total + question.points, 0), level, subjectId, tags, license, quizSnapshot: snapshot, publishedAt, updatedAt: now };
    const transactions = [];
    if (existing?.Item) for (const key of listingKeys(existing.Item.level, existing.Item.subjectId, existing.Item.publishedAt, id)) transactions.push({ Delete: { TableName: this.tableName, Key: key } });
    transactions.push({ Put: { TableName: this.tableName, Item: item } });
    transactions.push({ Put: { TableName: this.tableName, Item: { ...pointerKey(ownerId, quizId), entityType: 'QUIZ_BANK_SOURCE', ownerId, quizId, catalogId: id, updatedAt: now }, ...(hasPointer ? {} : { ConditionExpression: 'attribute_not_exists(PK)' }) } });
    for (const key of listingKeys(level, subjectId, publishedAt, id)) transactions.push({ Put: { TableName: this.tableName, Item: { ...key, entityType: 'QUIZ_BANK_LISTING', id, title: item.title, description: item.description, questionCount: item.questionCount, totalPoints: item.totalPoints, level, subjectId, tags, license, authorId: ownerId, sourceQuizId: quizId, publishedAt, updatedAt: now } } });
    await this.client.send(new TransactWriteCommand({ TransactItems: transactions }));
    return summary(item);
  }

  async copyToClass({ catalogId, classId, ownerId }) {
    const catalog = await this.getCatalog(catalogId);
    const snapshot = catalog.quizSnapshot;
    const quiz = await this.quizRepository.create({ classId, ownerId, ...snapshot, title: snapshot.title, description: snapshot.description, status: 'draft' });
    return { ...quiz, copiedFrom: summary(catalog) };
  }

  async unpublish({ catalogId, ownerId }) {
    const catalog = await this.getCatalog(catalogId);
    if (catalog.authorId !== ownerId) throw forbidden('Hanya pembuat kuis yang dapat menarik publikasi ini.');
    await this.client.send(new TransactWriteCommand({ TransactItems: [
      { Delete: { TableName: this.tableName, Key: catalogKey(catalog.id) } },
      { Delete: { TableName: this.tableName, Key: pointerKey(ownerId, catalog.sourceQuizId) } },
      ...listingKeys(catalog.level, catalog.subjectId, catalog.publishedAt, catalog.id).map((Key) => ({ Delete: { TableName: this.tableName, Key } })),
    ] }));
  }

}
