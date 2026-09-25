import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { conflict, forbidden, HttpError, notFound } from '../http/errors.js';

function sessionKey(classId, attendanceId) {
  return { PK: `CLASS#${classId}`, SK: `ATTENDANCE#${attendanceId}` };
}

function checkInKey(attendanceId, uid) {
  return { PK: `ATTENDANCE#${attendanceId}`, SK: `CHECKIN#${uid}` };
}

function publicCheckIn(item) {
  return item ? {
    uid: item.uid,
    name: item.name || 'Siswa Quizzy',
    status: 'present',
    distanceMeters: item.distanceMeters,
    accuracyMeters: item.accuracyMeters ?? null,
    checkedInAt: item.checkedInAt,
  } : null;
}

function publicSession(item, extra = {}, { includeLocation = true } = {}) {
  const locationMode = item.locationMode || 'on_site';
  return {
    id: item.id,
    classId: item.classId,
    title: item.title,
    sessionId: item.sessionId || null,
    locationMode,
    ...(includeLocation && locationMode === 'on_site' ? { latitude: item.latitude, longitude: item.longitude, radiusMeters: item.radiusMeters } : {}),
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    startedAt: item.startedAt || null,
    endedAt: item.endedAt || null,
    ...extra,
  };
}

function transactionConflict(error) {
  return error?.name === 'TransactionCanceledException' || error?.name === 'ConditionalCheckFailedException';
}

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const radius = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class AttendanceRepository {
  constructor({ tableName = process.env.TABLE_NAME, documentClient, classRepository, learningSessionRepository } = {}) {
    if (!tableName) throw new Error('TABLE_NAME is required');
    if (!classRepository) throw new Error('classRepository is required');
    this.tableName = tableName;
    this.classRepository = classRepository;
    this.learningSessionRepository = learningSessionRepository;
    this.client = documentClient || DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async access(classId, uid) {
    return this.classRepository.getForUser(classId, uid);
  }

  async requireOwner(classId, uid) {
    const classItem = await this.access(classId, uid);
    if (classItem.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat mengatur presensi.');
    return classItem;
  }

  async getSession(classId, attendanceId) {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: sessionKey(classId, attendanceId),
      ConsistentRead: true,
    }));
    if (!result.Item || result.Item.entityType !== 'ATTENDANCE') throw notFound('Sesi presensi tidak ditemukan.');
    return result.Item;
  }

  async list(classId, uid) {
    const classItem = await this.access(classId, uid);
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :class AND begins_with(SK, :attendance)',
      ExpressionAttributeValues: { ':class': `CLASS#${classId}`, ':attendance': 'ATTENDANCE#' },
      ConsistentRead: true,
    }));
    let sessions = (result.Items || []).filter((item) => item.entityType === 'ATTENDANCE');
    sessions.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    sessions = sessions.slice(0, 100);
    if (classItem.accessRole === 'owner') return sessions.map(publicSession);

    sessions = sessions.filter((item) => item.status !== 'draft');
    if (!sessions.length) return [];

    let pendingKeys = sessions.map((item) => checkInKey(item.id, uid));
    const checkInItems = [];
    for (let attempt = 0; attempt < 3 && pendingKeys.length; attempt += 1) {
      const checkInResult = await this.client.send(new BatchGetCommand({
        RequestItems: {
          [this.tableName]: { Keys: pendingKeys, ConsistentRead: true },
        },
      }));
      checkInItems.push(...(checkInResult.Responses?.[this.tableName] || []));
      pendingKeys = checkInResult.UnprocessedKeys?.[this.tableName]?.Keys || [];
    }
    if (pendingKeys.length) throw new HttpError(503, 'ATTENDANCE_LIST_UNAVAILABLE', 'Riwayat presensi sedang sibuk. Silakan coba lagi.');

    const checkIns = new Map(checkInItems
      .filter((item) => item.entityType === 'ATTENDANCE_CHECKIN')
      .map((item) => [item.attendanceId, item]));
    return sessions.map((item) => publicSession(item, { checkIn: publicCheckIn(checkIns.get(item.id)) }, { includeLocation: false }));
  }

  async create({ classId, ownerId, title, locationMode = 'online', latitude = null, longitude = null, radiusMeters = null, sessionId = null, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId);
    if (sessionId) {
      if (!this.learningSessionRepository) throw new Error('learningSessionRepository is required for session-linked attendance');
      await this.learningSessionRepository.requireAssignable(classId, sessionId, ownerId);
    }
    const id = randomUUID();
    const item = {
      ...sessionKey(classId, id),
      entityType: 'ATTENDANCE',
      id,
      classId,
      ownerId,
      title,
      locationMode,
      ...(locationMode === 'on_site' ? { latitude, longitude, radiusMeters } : {}),
      ...(sessionId ? { sessionId } : {}),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
    return publicSession(item);
  }

  async setStatus({ classId, attendanceId, ownerId, status, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId);
    const current = await this.getSession(classId, attendanceId);
    if (status === 'active' && current.status !== 'draft') {
      throw conflict('ATTENDANCE_ALREADY_STARTED', 'Sesi presensi hanya dapat dimulai dari status draf.');
    }
    if (status === 'ended' && current.status !== 'active') {
      throw conflict('ATTENDANCE_NOT_ACTIVE', 'Hanya sesi presensi aktif yang dapat diakhiri.');
    }
    try {
      const result = await this.client.send(new UpdateCommand({
        TableName: this.tableName,
        Key: sessionKey(classId, attendanceId),
        UpdateExpression: status === 'active'
          ? 'SET #status = :status, startedAt = :now, updatedAt = :now'
          : 'SET #status = :status, endedAt = :now, updatedAt = :now',
        ConditionExpression: 'ownerId = :owner AND #status = :expected',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': status,
          ':now': now,
          ':owner': ownerId,
          ':expected': status === 'active' ? 'draft' : 'active',
        },
        ReturnValues: 'ALL_NEW',
      }));
      return publicSession(result.Attributes);
    } catch (error) {
      if (!transactionConflict(error)) throw error;
      throw conflict('ATTENDANCE_STATUS_CONFLICT', 'Status sesi sudah berubah. Muat ulang lalu coba kembali.');
    }
  }

  async checkIn({ classId, attendanceId, uid, name, latitude, longitude, accuracyMeters, now = new Date().toISOString() }) {
    const classItem = await this.access(classId, uid);
    if (classItem.accessRole !== 'member') throw forbidden('Presensi siswa hanya tersedia untuk anggota kelas.');
    const session = await this.getSession(classId, attendanceId);
    if (session.status !== 'active') throw conflict('ATTENDANCE_NOT_ACTIVE', 'Sesi presensi tidak sedang aktif.');

    const existing = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: checkInKey(attendanceId, uid),
      ConsistentRead: true,
    }));
    if (existing.Item) return publicCheckIn(existing.Item);

    const locationMode = session.locationMode || 'on_site';
    let distanceMeters = null;
    if (locationMode === 'on_site') {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new HttpError(400, 'LOCATION_REQUIRED', 'Aktifkan lokasi perangkat untuk presensi di lokasi pertemuan.');
      }
      distanceMeters = Math.round(calculateDistanceMeters(latitude, longitude, session.latitude, session.longitude));
      if (distanceMeters > session.radiusMeters) {
        throw new HttpError(422, 'OUTSIDE_RADIUS', 'Lokasi berada di luar radius presensi.', {
          distanceMeters,
          radiusMeters: session.radiusMeters,
        });
      }
    }

    const item = {
      ...checkInKey(attendanceId, uid),
      entityType: 'ATTENDANCE_CHECKIN',
      attendanceId,
      classId,
      uid,
      name: name || 'Siswa Quizzy',
      ...(locationMode === 'on_site' ? { latitude, longitude, accuracyMeters, distanceMeters } : {}),
      checkedInAt: now,
    };
    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: this.tableName,
              Key: sessionKey(classId, attendanceId),
              ConditionExpression: '#status = :active',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: { ':active': 'active' },
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: item,
              ConditionExpression: 'attribute_not_exists(PK)',
            },
          },
        ],
      }));
      return publicCheckIn(item);
    } catch (error) {
      if (!transactionConflict(error)) throw error;
      const [refreshedSession, refreshedCheckIn] = await Promise.all([
        this.getSession(classId, attendanceId),
        this.client.send(new GetCommand({ TableName: this.tableName, Key: checkInKey(attendanceId, uid), ConsistentRead: true })),
      ]);
      if (refreshedCheckIn.Item) return publicCheckIn(refreshedCheckIn.Item);
      if (refreshedSession.status !== 'active') throw conflict('ATTENDANCE_NOT_ACTIVE', 'Sesi presensi sudah berakhir.');
      throw conflict('ATTENDANCE_CHECKIN_CONFLICT', 'Presensi belum dapat dicatat. Silakan coba lagi.');
    }
  }

  async detail(classId, attendanceId, uid) {
    const classItem = await this.access(classId, uid);
    const session = await this.getSession(classId, attendanceId);
    if (classItem.accessRole === 'member') {
      if (session.status === 'draft') throw notFound('Sesi presensi tidak ditemukan.');
      const result = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: checkInKey(attendanceId, uid),
        ConsistentRead: true,
      }));
      return publicSession(session, { checkIn: publicCheckIn(result.Item) }, { includeLocation: false });
    }

    const [members, checkIns] = await Promise.all([
      this.classRepository.listMembers(classId, uid),
      this.client.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :attendance AND begins_with(SK, :checkin)',
        ExpressionAttributeValues: { ':attendance': `ATTENDANCE#${attendanceId}`, ':checkin': 'CHECKIN#' },
        ConsistentRead: true,
        Limit: 100,
      })),
    ]);
    const byUid = new Map((checkIns.Items || []).filter((item) => item.entityType === 'ATTENDANCE_CHECKIN').map((item) => [item.uid, item]));
    const recap = members.map((member) => ({
      uid: member.uid,
      name: member.name,
      status: byUid.has(member.uid) ? 'present' : 'absent',
      checkIn: publicCheckIn(byUid.get(member.uid)),
    }));
    return publicSession(session, {
      recap,
      summary: {
        totalMembers: members.length,
        presentCount: recap.filter((item) => item.status === 'present').length,
        absentCount: recap.filter((item) => item.status === 'absent').length,
      },
    });
  }
}
