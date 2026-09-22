import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { forbidden, HttpError, notFound } from '../http/errors.js';

function summary(item, extra = {}) {
  return {
    id: item.id,
    classId: item.classId,
    title: item.title,
    summary: item.summary || '',
    status: item.status,
    blocksCount: item.blocks?.length || 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    publishedAt: item.publishedAt || null,
    ...extra,
  };
}

function detail(item, extra = {}) {
  return { ...summary(item), blocks: item.blocks || [], ...extra };
}

function stateKey(prefix, uid, classId, materialId) {
  return { PK: `USER#${uid}`, SK: `${prefix}#CLASS#${classId}#MATERIAL#${materialId}` };
}

export class MaterialRepository {
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
    const classItem = await this.access(classId, uid);
    if (classItem.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat mengubah materi.');
    return classItem;
  }

  async getItem(classId, materialId) {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: `CLASS#${classId}`, SK: `MATERIAL#${materialId}` },
      ConsistentRead: true,
    }));
    if (!result.Item || result.Item.status === 'deleted') throw notFound('Materi tidak ditemukan.');
    return result.Item;
  }

  async learningState(uid, classId, materialId) {
    const [progress, bookmark] = await Promise.all([
      this.client.send(new GetCommand({ TableName: this.tableName, Key: stateKey('PROGRESS', uid, classId, materialId), ConsistentRead: true })),
      this.client.send(new GetCommand({ TableName: this.tableName, Key: stateKey('BOOKMARK', uid, classId, materialId), ConsistentRead: true })),
    ]);
    return {
      progress: progress.Item ? { percent: progress.Item.percent, status: progress.Item.status, lastReadAt: progress.Item.lastReadAt, completedAt: progress.Item.completedAt || null } : null,
      bookmarked: Boolean(bookmark.Item),
    };
  }

  async list(classId, uid) {
    const classItem = await this.access(classId, uid);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :class AND begins_with(SK, :material)',
      ExpressionAttributeValues: { ':class': `CLASS#${classId}`, ':material': 'MATERIAL#' },
      ScanIndexForward: false,
      Limit: 100,
    }));
    let items = (result.Items || []).filter((item) => item.status !== 'deleted');
    if (classItem.accessRole !== 'owner') items = items.filter((item) => item.status === 'published');
    items.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    if (classItem.accessRole === 'owner' || !items.length) return items.map(summary);
    const states = await Promise.all(items.map((item) => this.learningState(uid, classId, item.id)));
    return items.map((item, index) => summary(item, states[index]));
  }

  async get(classId, materialId, uid) {
    const classItem = await this.access(classId, uid);
    const item = await this.getItem(classId, materialId);
    if (classItem.accessRole !== 'owner' && item.status !== 'published') throw notFound('Materi tidak ditemukan.');
    const extra = classItem.accessRole === 'owner' ? { accessRole: 'owner' } : { accessRole: 'member', ...(await this.learningState(uid, classId, materialId)) };
    return detail(item, extra);
  }

  async create({ classId, ownerId, title, summary: materialSummary, status, blocks, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId);
    const id = randomUUID();
    const item = {
      PK: `CLASS#${classId}`,
      SK: `MATERIAL#${id}`,
      entityType: 'MATERIAL',
      id,
      classId,
      ownerId,
      title,
      summary: materialSummary,
      status,
      blocks,
      createdAt: now,
      updatedAt: now,
      ...(status === 'published' ? { publishedAt: now } : {}),
    };
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: this.tableName, Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
        {
          Update: {
            TableName: this.tableName,
            Key: { PK: `CLASS#${classId}`, SK: 'META' },
            UpdateExpression: 'SET updatedAt = :now ADD materialsCount :one',
            ConditionExpression: 'ownerId = :owner',
            ExpressionAttributeValues: { ':now': now, ':one': 1, ':owner': ownerId },
          },
        },
      ],
    }));
    return detail(item, { accessRole: 'owner' });
  }

  async update({ classId, materialId, ownerId, title, summary: materialSummary, status, blocks, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId);
    const current = await this.getItem(classId, materialId);
    const item = {
      ...current,
      title,
      summary: materialSummary,
      status,
      blocks,
      updatedAt: now,
      ...(status === 'published' ? { publishedAt: current.publishedAt || now } : {}),
    };
    if (status !== 'published') delete item.publishedAt;
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'ownerId = :owner AND attribute_exists(PK)',
      ExpressionAttributeValues: { ':owner': ownerId },
    }));
    return detail(item, { accessRole: 'owner' });
  }

  async remove(classId, materialId, ownerId, now = new Date().toISOString()) {
    await this.requireOwner(classId, ownerId);
    await this.getItem(classId, materialId);
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: this.tableName,
            Key: { PK: `CLASS#${classId}`, SK: `MATERIAL#${materialId}` },
            UpdateExpression: 'SET #status = :deleted, deletedAt = :now, updatedAt = :now',
            ConditionExpression: 'ownerId = :owner',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':deleted': 'deleted', ':now': now, ':owner': ownerId },
          },
        },
        {
          Update: {
            TableName: this.tableName,
            Key: { PK: `CLASS#${classId}`, SK: 'META' },
            UpdateExpression: 'SET updatedAt = :now ADD materialsCount :minusOne',
            ConditionExpression: 'ownerId = :owner AND materialsCount > :zero',
            ExpressionAttributeValues: { ':now': now, ':minusOne': -1, ':zero': 0, ':owner': ownerId },
          },
        },
      ],
    }));
  }

  async setProgress({ classId, materialId, uid, percent, now = new Date().toISOString() }) {
    const classItem = await this.access(classId, uid);
    if (classItem.accessRole !== 'member') throw forbidden('Progres belajar hanya tersedia untuk anggota kelas.');
    const material = await this.getItem(classId, materialId);
    if (material.status !== 'published') throw notFound('Materi tidak ditemukan.');
    const status = percent === 100 ? 'completed' : 'started';
    const result = await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: stateKey('PROGRESS', uid, classId, materialId),
      UpdateExpression: `SET entityType = :entity, classId = :classId, materialId = :materialId, percent = :percent, #status = :status, lastReadAt = :now, updatedAt = :now, createdAt = if_not_exists(createdAt, :now)${percent === 100 ? ', completedAt = :now' : ' REMOVE completedAt'}`,
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':entity': 'PROGRESS', ':classId': classId, ':materialId': materialId, ':percent': percent, ':status': status, ':now': now },
      ReturnValues: 'ALL_NEW',
    }));
    return { percent: result.Attributes.percent, status: result.Attributes.status, lastReadAt: result.Attributes.lastReadAt, completedAt: result.Attributes.completedAt || null };
  }

  async setBookmark({ classId, materialId, uid, saved, now = new Date().toISOString() }) {
    const classItem = await this.access(classId, uid);
    if (classItem.accessRole !== 'member') throw forbidden('Materi tersimpan hanya tersedia untuk anggota kelas.');
    const material = await this.getItem(classId, materialId);
    if (material.status !== 'published') throw notFound('Materi tidak ditemukan.');
    const key = stateKey('BOOKMARK', uid, classId, materialId);
    if (saved) {
      await this.client.send(new PutCommand({ TableName: this.tableName, Item: { ...key, entityType: 'BOOKMARK', classId, materialId, savedAt: now } }));
    } else {
      await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: key }));
    }
    return { bookmarked: saved };
  }

  async batchMaterials(keys) {
    if (!keys.length) return new Map();
    let pending = keys;
    const items = [];
    for (let attempt = 0; attempt < 3 && pending.length; attempt += 1) {
      const result = await this.client.send(new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: pending, ConsistentRead: true } } }));
      items.push(...(result.Responses?.[this.tableName] || []));
      pending = result.UnprocessedKeys?.[this.tableName]?.Keys || [];
    }
    if (pending.length) throw new HttpError(503, 'LEARNING_STATE_UNAVAILABLE', 'Data belajar sedang sibuk. Silakan coba lagi.');
    return new Map(items.filter((item) => item.status === 'published').map((item) => [`${item.classId}#${item.id}`, item]));
  }

  async listUserState(uid, kind) {
    const prefix = kind === 'bookmarks' ? 'BOOKMARK#' : 'PROGRESS#';
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :user AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':user': `USER#${uid}`, ':prefix': prefix },
      ScanIndexForward: false,
      Limit: 100,
    }));
    const states = result.Items || [];
    const materials = await this.batchMaterials(states.map((item) => ({ PK: `CLASS#${item.classId}`, SK: `MATERIAL#${item.materialId}` })));
    return states.map((item) => {
      const material = materials.get(`${item.classId}#${item.materialId}`);
      if (!material) return null;
      return summary(material, kind === 'bookmarks'
        ? { bookmarked: true, savedAt: item.savedAt }
        : { progress: { percent: item.percent, status: item.status, lastReadAt: item.lastReadAt, completedAt: item.completedAt || null } });
    }).filter(Boolean).sort((left, right) => {
      const leftDate = left.savedAt || left.progress?.lastReadAt || '';
      const rightDate = right.savedAt || right.progress?.lastReadAt || '';
      return rightDate.localeCompare(leftDate);
    });
  }
}
