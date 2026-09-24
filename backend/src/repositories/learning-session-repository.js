import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { conflict, forbidden, notFound } from '../http/errors.js';

function publicSession(item, extra = {}) {
  return {
    id: item.id,
    classId: item.classId,
    title: item.title,
    description: item.description || '',
    meetingDate: item.meetingDate,
    status: item.status,
    sortOrder: Number(item.sortOrder || 0),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt || null,
    archivedAt: item.archivedAt || null,
    ...extra,
  };
}

function sortSessions(left, right) {
  return Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
    || left.meetingDate.localeCompare(right.meetingDate)
    || left.createdAt.localeCompare(right.createdAt);
}

export class LearningSessionRepository {
  constructor({ tableName = process.env.TABLE_NAME, documentClient, classRepository } = {}) {
    if (!tableName) throw new Error('TABLE_NAME is required');
    if (!classRepository) throw new Error('classRepository is required');
    this.tableName = tableName;
    this.classRepository = classRepository;
    this.client = documentClient || DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async access(classId, uid) {
    return this.classRepository.getForUser(classId, uid);
  }

  async requireOwner(classId, uid) {
    const access = await this.access(classId, uid);
    if (access.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat mengatur pertemuan.');
    return access;
  }

  async getItem(classId, sessionId) {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: `CLASS#${classId}`, SK: `SESSION#${sessionId}` },
      ConsistentRead: true,
    }));
    if (!result.Item || result.Item.entityType !== 'LEARNING_SESSION') throw notFound('Pertemuan tidak ditemukan.');
    return result.Item;
  }

  async listItems(classId) {
    const items = [];
    let lastEvaluatedKey;
    do {
      const result = await this.client.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :class AND begins_with(SK, :session)',
        ExpressionAttributeValues: { ':class': `CLASS#${classId}`, ':session': 'SESSION#' },
        ConsistentRead: true,
        Limit: 100,
        ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
      }));
      items.push(...(result.Items || []).filter((item) => item.entityType === 'LEARNING_SESSION'));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    return items.sort(sortSessions);
  }

  async list(classId, uid) {
    const access = await this.access(classId, uid);
    let items = await this.listItems(classId);
    if (access.accessRole !== 'owner') items = items.filter((item) => item.status === 'published');
    return items.map((item) => publicSession(item, { accessRole: access.accessRole }));
  }

  async get(classId, sessionId, uid) {
    const access = await this.access(classId, uid);
    const item = await this.getItem(classId, sessionId);
    if (access.accessRole !== 'owner' && item.status !== 'published') throw notFound('Pertemuan tidak ditemukan.');
    return publicSession(item, { accessRole: access.accessRole });
  }

  async create({ classId, ownerId, title, description, meetingDate, status, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId);
    const existing = await this.listItems(classId);
    if (existing.length >= 100) throw conflict('SESSION_LIMIT_REACHED', 'Satu kelas maksimal memiliki 100 pertemuan.');
    const id = randomUUID();
    const item = {
      PK: `CLASS#${classId}`,
      SK: `SESSION#${id}`,
      entityType: 'LEARNING_SESSION',
      id,
      classId,
      ownerId,
      title,
      description,
      meetingDate,
      status,
      sortOrder: Date.parse(now),
      createdAt: now,
      updatedAt: now,
      ...(status === 'published' ? { publishedAt: now } : {}),
      ...(status === 'archived' ? { archivedAt: now } : {}),
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    return publicSession(item, { accessRole: 'owner' });
  }

  async update({ classId, sessionId, ownerId, title, description, meetingDate, status, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId);
    const current = await this.getItem(classId, sessionId);
    if (current.ownerId !== ownerId) throw forbidden('Hanya pengelola kelas yang dapat mengubah pertemuan.');
    const item = {
      ...current,
      title,
      description,
      meetingDate,
      status,
      updatedAt: now,
      ...(status === 'published' ? { publishedAt: current.publishedAt || now } : {}),
      ...(status === 'archived' ? { archivedAt: current.archivedAt || now } : {}),
    };
    if (status !== 'archived') delete item.archivedAt;
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'ownerId = :owner AND attribute_exists(PK)',
      ExpressionAttributeValues: { ':owner': ownerId },
    }));
    return publicSession(item, { accessRole: 'owner' });
  }

  async reorder({ classId, ownerId, sessionIds, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId);
    const existing = await this.listItems(classId);
    const byId = new Map(existing.map((item) => [item.id, item]));
    if (sessionIds.length !== existing.length || sessionIds.some((id) => !byId.has(id))) {
      throw conflict('SESSION_ORDER_CHANGED', 'Daftar pertemuan sudah berubah. Muat ulang lalu coba lagi.');
    }
    await this.client.send(new TransactWriteCommand({
      TransactItems: sessionIds.map((sessionId, index) => ({
        Update: {
          TableName: this.tableName,
          Key: { PK: `CLASS#${classId}`, SK: `SESSION#${sessionId}` },
          UpdateExpression: 'SET sortOrder = :order, updatedAt = :now',
          ConditionExpression: 'ownerId = :owner AND attribute_exists(PK)',
          ExpressionAttributeValues: { ':order': (index + 1) * 1000, ':now': now, ':owner': ownerId },
        },
      })),
    }));
    return this.list(classId, ownerId);
  }

  async requireAssignable(classId, sessionId, ownerId) {
    await this.requireOwner(classId, ownerId);
    const session = await this.getItem(classId, sessionId);
    if (session.ownerId !== ownerId) throw forbidden('Pertemuan tidak dapat digunakan pada kelas ini.');
    if (session.status === 'archived') throw conflict('SESSION_ARCHIVED', 'Pertemuan yang diarsipkan tidak dapat menerima konten baru.');
    return publicSession(session, { accessRole: 'owner' });
  }
}
