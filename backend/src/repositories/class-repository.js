import { randomBytes, randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { conflict, forbidden, HttpError, notFound } from '../http/errors.js';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const OWNER_INDEX = 'OwnerIndex';

function createClassCode() {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

function publicClass(item, extra = {}) {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description || '',
    teacherName: item.teacherName || '',
    status: item.status,
    studentsCount: item.studentsCount || 0,
    materialsCount: item.materialsCount || 0,
    quizzesCount: item.quizzesCount || 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...extra,
  };
}

function publicMember(item) {
  return {
    uid: item.uid,
    name: item.name || 'Siswa Quizzy',
    joinedAt: item.joinedAt,
  };
}

function isTransactionConflict(error) {
  return error?.name === 'TransactionCanceledException' || error?.name === 'ConditionalCheckFailedException';
}

export class ClassRepository {
  constructor({ tableName = process.env.TABLE_NAME, documentClient } = {}) {
    if (!tableName) throw new Error('TABLE_NAME is required');
    this.tableName = tableName;
    this.client = documentClient || DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async listOwnedBy(ownerId) {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: OWNER_INDEX,
      KeyConditionExpression: 'GSI1PK = :owner AND begins_with(GSI1SK, :entity)',
      ExpressionAttributeValues: { ':owner': `OWNER#${ownerId}`, ':entity': 'CLASS#' },
      ScanIndexForward: false,
      Limit: 50,
    }));
    return (result.Items || []).map((item) => publicClass(item, { accessRole: 'owner' }));
  }

  async listJoinedBy(uid) {
    const memberships = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :user AND begins_with(SK, :class)',
      ExpressionAttributeValues: { ':user': `USER#${uid}`, ':class': 'CLASS#' },
      ScanIndexForward: false,
      Limit: 50,
    }));
    const items = memberships.Items || [];
    if (!items.length) return [];

    let pendingKeys = items.map((item) => ({ PK: `CLASS#${item.classId}`, SK: 'META' }));
    const classItems = [];
    for (let attempt = 0; attempt < 3 && pendingKeys.length; attempt += 1) {
      const result = await this.client.send(new BatchGetCommand({
        RequestItems: {
          [this.tableName]: { Keys: pendingKeys, ConsistentRead: true },
        },
      }));
      classItems.push(...(result.Responses?.[this.tableName] || []));
      pendingKeys = result.UnprocessedKeys?.[this.tableName]?.Keys || [];
    }
    if (pendingKeys.length) throw new HttpError(503, 'CLASS_LIST_UNAVAILABLE', 'Daftar kelas sedang sibuk. Silakan coba lagi.');
    const classesById = new Map(classItems.map((item) => [item.id, item]));
    return items
      .sort((left, right) => right.joinedAt.localeCompare(left.joinedAt))
      .map((membership) => {
        const classItem = classesById.get(membership.classId);
        return classItem ? publicClass(classItem, { accessRole: 'member', joinedAt: membership.joinedAt }) : null;
      })
      .filter(Boolean);
  }

  async create({ ownerId, teacherName, name, description, now = new Date().toISOString() }) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const id = randomUUID();
      const code = createClassCode();
      const classItem = {
        PK: `CLASS#${id}`,
        SK: 'META',
        GSI1PK: `OWNER#${ownerId}`,
        GSI1SK: `CLASS#${now}#${id}`,
        entityType: 'CLASS',
        id,
        code,
        name,
        description,
        ownerId,
        teacherName,
        status: 'active',
        studentsCount: 0,
        materialsCount: 0,
        quizzesCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      try {
        await this.client.send(new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: classItem,
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  PK: `CLASS_CODE#${code}`,
                  SK: 'LOOKUP',
                  entityType: 'CLASS_CODE',
                  classId: id,
                  createdAt: now,
                },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
          ],
        }));
        return publicClass(classItem);
      } catch (error) {
        if (!isTransactionConflict(error)) throw error;
      }
    }
    throw new HttpError(409, 'CLASS_CODE_CONFLICT', 'Kode kelas belum dapat dibuat. Silakan coba lagi.');
  }

  async joinByCode({ uid, name, code, idempotencyKey, now = new Date().toISOString() }) {
    const lookup = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: `CLASS_CODE#${code}`, SK: 'LOOKUP' },
      ConsistentRead: true,
    }));
    if (!lookup.Item?.classId) throw notFound('Kelas dengan kode tersebut tidak ditemukan.');

    const classKey = { PK: `CLASS#${lookup.Item.classId}`, SK: 'META' };
    const classResult = await this.client.send(new GetCommand({ TableName: this.tableName, Key: classKey, ConsistentRead: true }));
    const classItem = classResult.Item;
    if (!classItem) throw notFound('Kelas tidak lagi tersedia.');
    if (classItem.ownerId === uid) throw conflict('CLASS_OWNER_CANNOT_JOIN', 'Anda sudah menjadi pengelola kelas ini.');
    if (classItem.status !== 'active') throw conflict('CLASS_NOT_ACTIVE', 'Kelas ini sedang tidak menerima anggota.');

    const memberKey = { PK: classKey.PK, SK: `MEMBER#${uid}` };
    const existing = await this.client.send(new GetCommand({ TableName: this.tableName, Key: memberKey, ConsistentRead: true }));
    if (existing.Item) return publicClass(classItem, { accessRole: 'member', joinedAt: existing.Item.joinedAt });

    try {
      await this.client.send(new TransactWriteCommand({
        ...(idempotencyKey ? { ClientRequestToken: idempotencyKey } : {}),
        TransactItems: [
          {
            Put: {
              TableName: this.tableName,
              Item: {
                ...memberKey,
                entityType: 'CLASS_MEMBER',
                classId: classItem.id,
                uid,
                name: name || 'Siswa Quizzy',
                joinedAt: now,
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: {
                PK: `USER#${uid}`,
                SK: `CLASS#${classItem.id}`,
                entityType: 'USER_CLASS',
                classId: classItem.id,
                joinedAt: now,
              },
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
          {
            Update: {
              TableName: this.tableName,
              Key: classKey,
              UpdateExpression: 'SET updatedAt = :now ADD studentsCount :one',
              ConditionExpression: 'ownerId <> :uid AND #status = :active',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: { ':now': now, ':one': 1, ':uid': uid, ':active': 'active' },
            },
          },
        ],
      }));
      return publicClass({ ...classItem, studentsCount: (classItem.studentsCount || 0) + 1, updatedAt: now }, { accessRole: 'member', joinedAt: now });
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;
      const [memberResult, refreshedClass] = await Promise.all([
        this.client.send(new GetCommand({ TableName: this.tableName, Key: memberKey, ConsistentRead: true })),
        this.client.send(new GetCommand({ TableName: this.tableName, Key: classKey, ConsistentRead: true })),
      ]);
      if (memberResult.Item && refreshedClass.Item) {
        return publicClass(refreshedClass.Item, { accessRole: 'member', joinedAt: memberResult.Item.joinedAt });
      }
      throw conflict('CLASS_JOIN_CONFLICT', 'Kelas belum dapat diikuti. Silakan coba lagi.');
    }
  }

  async getForUser(classId, uid) {
    const classKey = { PK: `CLASS#${classId}`, SK: 'META' };
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: classKey, ConsistentRead: true }));
    const classItem = result.Item;
    if (!classItem) throw notFound('Kelas tidak ditemukan.');
    if (classItem.ownerId === uid) return publicClass(classItem, { accessRole: 'owner' });

    const membership = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: classKey.PK, SK: `MEMBER#${uid}` },
      ConsistentRead: true,
    }));
    if (!membership.Item) throw forbidden('Anda bukan anggota kelas ini.');
    return publicClass(classItem, { accessRole: 'member', joinedAt: membership.Item.joinedAt });
  }

  async listMembers(classId, ownerId) {
    const classResult = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: `CLASS#${classId}`, SK: 'META' },
      ConsistentRead: true,
    }));
    if (!classResult.Item) throw notFound('Kelas tidak ditemukan.');
    if (classResult.Item.ownerId !== ownerId) throw forbidden('Hanya pengelola kelas yang dapat melihat daftar anggota.');

    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :class AND begins_with(SK, :member)',
      ExpressionAttributeValues: { ':class': `CLASS#${classId}`, ':member': 'MEMBER#' },
      ScanIndexForward: false,
      Limit: 100,
    }));
    return (result.Items || []).map(publicMember);
  }
}
