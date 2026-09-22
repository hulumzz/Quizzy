import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { forbidden, notFound } from '../http/errors.js';

function partition(materialId) {
  return `MATERIAL#${materialId}`;
}

function discussionKey(materialId, discussionId) {
  return { PK: partition(materialId), SK: `DISCUSSION#${discussionId}` };
}

function replyKey(materialId, discussionId, replyId) {
  return { PK: partition(materialId), SK: `DISCUSSION#${discussionId}#REPLY#${replyId}` };
}

function publicMessage(item, uid) {
  return {
    id: item.id,
    content: item.deleted ? '' : item.content,
    author: { name: item.authorName, role: item.authorRole },
    canEdit: !item.deleted && item.authorId === uid,
    deleted: Boolean(item.deleted),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    editedAt: item.editedAt || null,
  };
}

function publicDiscussion(item, replies, uid) {
  return {
    ...publicMessage(item, uid),
    status: item.status || 'open',
    answerId: item.answerId || null,
    replies: replies.map((reply) => ({
      ...publicMessage(reply, uid),
      discussionId: item.id,
      isAnswer: item.answerId === reply.id,
    })),
  };
}

export class DiscussionRepository {
  constructor({ tableName = process.env.TABLE_NAME, documentClient, materialRepository } = {}) {
    if (!tableName) throw new Error('TABLE_NAME is required');
    if (!materialRepository) throw new Error('materialRepository is required');
    this.tableName = tableName;
    this.materialRepository = materialRepository;
    this.client = documentClient || DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async access(classId, materialId, uid) {
    return this.materialRepository.get(classId, materialId, uid);
  }

  async getRecord(key, missingMessage = 'Pesan diskusi tidak ditemukan.') {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: key, ConsistentRead: true }));
    if (!result.Item) throw notFound(missingMessage);
    return result.Item;
  }

  async list(classId, materialId, uid) {
    const material = await this.access(classId, materialId, uid);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :material AND begins_with(SK, :discussion)',
      ExpressionAttributeValues: { ':material': partition(materialId), ':discussion': 'DISCUSSION#' },
      ConsistentRead: true,
      Limit: 150,
    }));
    const roots = [];
    const replies = new Map();
    for (const item of result.Items || []) {
      if (item.entityType === 'DISCUSSION') roots.push(item);
      if (item.entityType === 'DISCUSSION_REPLY') {
        const collection = replies.get(item.discussionId) || [];
        collection.push(item);
        replies.set(item.discussionId, collection);
      }
    }
    roots.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return {
      material: { id: material.id, classId: material.classId, title: material.title, status: material.status },
      canResolve: material.accessRole === 'owner',
      discussions: roots.map((item) => publicDiscussion(
        item,
        (replies.get(item.id) || []).sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
        uid,
      )),
    };
  }

  async create({ classId, materialId, uid, authorName, content, now = new Date().toISOString() }) {
    const material = await this.access(classId, materialId, uid);
    const id = randomUUID();
    const item = {
      ...discussionKey(materialId, id),
      entityType: 'DISCUSSION',
      id,
      classId,
      materialId,
      authorId: uid,
      authorName,
      authorRole: material.accessRole === 'owner' ? 'teacher' : 'student',
      content,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    return publicDiscussion(item, [], uid);
  }

  async reply({ classId, materialId, discussionId, uid, authorName, content, now = new Date().toISOString() }) {
    const material = await this.access(classId, materialId, uid);
    const discussion = await this.getRecord(discussionKey(materialId, discussionId), 'Diskusi tidak ditemukan.');
    if (discussion.deleted) throw notFound('Diskusi tidak ditemukan.');
    const id = randomUUID();
    const item = {
      ...replyKey(materialId, discussionId, id),
      entityType: 'DISCUSSION_REPLY',
      id,
      discussionId,
      classId,
      materialId,
      authorId: uid,
      authorName,
      authorRole: material.accessRole === 'owner' ? 'teacher' : 'student',
      content,
      createdAt: now,
      updatedAt: now,
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    return { ...publicMessage(item, uid), discussionId, isAnswer: false };
  }

  async update({ classId, materialId, discussionId, replyId, uid, content, now = new Date().toISOString() }) {
    await this.access(classId, materialId, uid);
    const key = replyId ? replyKey(materialId, discussionId, replyId) : discussionKey(materialId, discussionId);
    const current = await this.getRecord(key);
    if (current.authorId !== uid) throw forbidden('Anda hanya dapat mengedit pesan sendiri.');
    if (current.deleted) throw notFound('Pesan diskusi tidak ditemukan.');
    const result = await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: 'SET content = :content, editedAt = :now, updatedAt = :now',
      ConditionExpression: 'authorId = :uid AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: { ':content': content, ':now': now, ':uid': uid },
      ReturnValues: 'ALL_NEW',
    }));
    return replyId
      ? { ...publicMessage(result.Attributes, uid), discussionId, isAnswer: false }
      : publicDiscussion(result.Attributes, [], uid);
  }

  async remove({ classId, materialId, discussionId, replyId, uid, now = new Date().toISOString() }) {
    await this.access(classId, materialId, uid);
    const key = replyId ? replyKey(materialId, discussionId, replyId) : discussionKey(materialId, discussionId);
    const current = await this.getRecord(key);
    if (current.authorId !== uid) throw forbidden('Anda hanya dapat menghapus pesan sendiri.');
    if (current.deleted) return;
    if (replyId) {
      const discussion = await this.getRecord(discussionKey(materialId, discussionId), 'Diskusi tidak ditemukan.');
      if (discussion.answerId === replyId) {
        await this.client.send(new TransactWriteCommand({
          TransactItems: [
            { Update: {
              TableName: this.tableName,
              Key: key,
              UpdateExpression: 'SET deleted = :deleted, deletedAt = :now, updatedAt = :now REMOVE content',
              ConditionExpression: 'authorId = :uid',
              ExpressionAttributeValues: { ':deleted': true, ':now': now, ':uid': uid },
            } },
            { Update: {
              TableName: this.tableName,
              Key: discussionKey(materialId, discussionId),
              UpdateExpression: 'SET #status = :open, updatedAt = :now REMOVE answerId, resolvedAt, resolvedBy',
              ConditionExpression: 'answerId = :answerId',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: { ':open': 'open', ':now': now, ':answerId': replyId },
            } },
          ],
        }));
        return;
      }
    }
    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: 'SET deleted = :deleted, deletedAt = :now, updatedAt = :now REMOVE content',
      ConditionExpression: 'authorId = :uid',
      ExpressionAttributeValues: { ':deleted': true, ':now': now, ':uid': uid },
    }));
  }

  async setStatus({ classId, materialId, discussionId, uid, status, answerId, now = new Date().toISOString() }) {
    const material = await this.access(classId, materialId, uid);
    if (material.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat menandai jawaban.');
    const discussion = await this.getRecord(discussionKey(materialId, discussionId), 'Diskusi tidak ditemukan.');
    if (discussion.deleted) throw notFound('Diskusi tidak ditemukan.');
    if (answerId) {
      const answer = await this.getRecord(replyKey(materialId, discussionId, answerId), 'Jawaban tidak ditemukan.');
      if (answer.deleted) throw notFound('Jawaban tidak ditemukan.');
    }
    const updateExpression = answerId
      ? 'SET #status = :status, answerId = :answerId, resolvedAt = :now, resolvedBy = :uid, updatedAt = :now'
      : status === 'resolved'
        ? 'SET #status = :status, resolvedAt = :now, resolvedBy = :uid, updatedAt = :now REMOVE answerId'
        : 'SET #status = :status, updatedAt = :now REMOVE answerId, resolvedAt, resolvedBy';
    const result = await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: discussionKey(materialId, discussionId),
      UpdateExpression: updateExpression,
      ConditionExpression: 'attribute_exists(PK)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': status, ':now': now, ...(status === 'resolved' ? { ':uid': uid } : {}), ...(answerId ? { ':answerId': answerId } : {}) },
      ReturnValues: 'ALL_NEW',
    }));
    return { status: result.Attributes.status, answerId: result.Attributes.answerId || null };
  }
}
