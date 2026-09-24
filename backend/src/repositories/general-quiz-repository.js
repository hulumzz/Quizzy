import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { forbidden, notFound } from '../http/errors.js';

const key = (ownerId, quizId) => ({ PK: `TEACHER#${ownerId}`, SK: `GENERAL_QUIZ#${quizId}` });
const totalPoints = (questions = []) => questions.reduce((sum, question) => sum + question.points, 0);
const summary = (item) => ({
  id: item.id, ownerId: item.ownerId, scope: 'general', title: item.title, description: item.description || '',
  status: item.status, mode: item.mode, questionCount: item.questions?.length || 0, totalPoints: totalPoints(item.questions),
  settings: item.settings, createdAt: item.createdAt, updatedAt: item.updatedAt, publishedAt: item.publishedAt || null,
});

export class GeneralQuizRepository {
  constructor({ tableName = process.env.TABLE_NAME, documentClient } = {}) {
    if (!tableName) throw new Error('TABLE_NAME is required');
    this.tableName = tableName;
    this.client = documentClient || DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  }

  async getItem(ownerId, quizId) {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: key(ownerId, quizId), ConsistentRead: true }));
    if (!result.Item || result.Item.status === 'deleted') throw notFound('Kuis umum tidak ditemukan.');
    return result.Item;
  }

  async list(ownerId) {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `TEACHER#${ownerId}`, ':prefix': 'GENERAL_QUIZ#' },
      ScanIndexForward: false,
      Limit: 100,
    }));
    return (result.Items || []).filter((item) => item.status !== 'deleted').sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).map(summary);
  }

  async get(ownerId, quizId) {
    const item = await this.getItem(ownerId, quizId);
    return { ...summary(item), questions: item.questions, accessRole: 'owner' };
  }

  async create({ ownerId, now = new Date().toISOString(), ...input }) {
    const id = randomUUID();
    const item = {
      ...key(ownerId, id), entityType: 'GENERAL_QUIZ', id, ownerId, scope: 'general', ...input,
      createdAt: now, updatedAt: now, ...(input.status === 'published' ? { publishedAt: now } : {}),
    };
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
    return { ...summary(item), questions: item.questions, accessRole: 'owner' };
  }

  async update({ ownerId, quizId, now = new Date().toISOString(), ...input }) {
    const current = await this.getItem(ownerId, quizId);
    if (current.ownerId !== ownerId) throw forbidden('Hanya pembuat kuis yang dapat mengubahnya.');
    const item = { ...current, ...input, updatedAt: now, ...(input.status === 'published' ? { publishedAt: current.publishedAt || now } : {}) };
    if (input.status !== 'published') delete item.publishedAt;
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item, ConditionExpression: 'ownerId = :owner AND attribute_exists(PK)', ExpressionAttributeValues: { ':owner': ownerId } }));
    return { ...summary(item), questions: item.questions, accessRole: 'owner' };
  }

  async remove(ownerId, quizId, now = new Date().toISOString()) {
    const current = await this.getItem(ownerId, quizId);
    if (current.ownerId !== ownerId) throw forbidden('Hanya pembuat kuis yang dapat menghapusnya.');
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...current, status: 'deleted', deletedAt: now, updatedAt: now },
      ConditionExpression: 'ownerId = :owner AND attribute_exists(PK)',
      ExpressionAttributeValues: { ':owner': ownerId },
    }));
  }
}
