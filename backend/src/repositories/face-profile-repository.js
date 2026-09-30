import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

function profileKey(uid) {
  return { PK: `USER#${uid}`, SK: 'FACE_PROFILE' };
}

function publicProfile(item) {
  if (!item || item.entityType !== 'FACE_PROFILE') return null;
  return {
    embedding: item.embedding,
    modelVersion: item.modelVersion,
    status: item.status,
    enrolledAt: item.enrolledAt,
    updatedAt: item.updatedAt,
  };
}

export class FaceProfileRepository {
  constructor({ tableName = process.env.TABLE_NAME, documentClient } = {}) {
    if (!tableName) throw new Error('TABLE_NAME is required');
    this.tableName = tableName;
    this.client = documentClient || DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async get(uid) {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: profileKey(uid),
      ConsistentRead: true,
    }));
    return publicProfile(result.Item);
  }

  async save({ uid, embedding, modelVersion, now = new Date().toISOString() }) {
    const current = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: profileKey(uid),
      ConsistentRead: true,
    }));
    const item = {
      ...profileKey(uid),
      entityType: 'FACE_PROFILE',
      uid,
      embedding,
      modelVersion,
      status: 'active',
      enrolledAt: current.Item?.entityType === 'FACE_PROFILE' ? current.Item.enrolledAt : now,
      updatedAt: now,
    };
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item }));
    return publicProfile(item);
  }

  async remove(uid) {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: profileKey(uid) }));
  }
}
