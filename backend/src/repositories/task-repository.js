import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { conflict, forbidden, notFound } from '../http/errors.js';

function taskKey(classId, taskId) { return { PK: `CLASS#${classId}`, SK: `TASK#${taskId}` }; }
function submissionKey(taskId, uid) { return { PK: `TASK#${taskId}`, SK: `SUBMISSION#${uid}` }; }

function summary(item, extra = {}) {
  return { id: item.id, classId: item.classId, title: item.title, instructions: item.instructions || '', dueAt: item.dueAt, responseMode: item.responseMode, status: item.status, sessionId: item.sessionId || null, createdAt: item.createdAt, updatedAt: item.updatedAt, publishedAt: item.publishedAt || null, ...extra };
}

function publicSubmission(item, extra = {}) {
  if (!item) return null;
  return { studentId: item.studentId, studentName: item.studentName, textAnswer: item.textAnswer || '', attachments: item.attachments || [], status: item.status, late: Boolean(item.late), submittedAt: item.submittedAt, attemptNumber: item.attemptNumber, revisionCount: item.revisionCount || 0, score: item.score ?? null, feedback: item.feedback || '', gradedAt: item.gradedAt || null, gradedBy: item.gradedBy || null, returnedAt: item.returnedAt || null, ...extra };
}

function historyEntry(item, now) {
  const id = randomUUID();
  return {
    PK: `TASK#${item.taskId}`,
    SK: `REVISION#${item.studentId}#${now}#${id}`,
    entityType: 'TASK_SUBMISSION_REVISION',
    id,
    taskId: item.taskId,
    classId: item.classId,
    studentId: item.studentId,
    studentName: item.studentName,
    previousStatus: item.status,
    previousScore: item.score ?? null,
    previousFeedback: item.feedback || '',
    previousSubmittedAt: item.submittedAt,
    previousAttemptNumber: item.attemptNumber,
    createdAt: now,
  };
}

export class TaskRepository {
  constructor({ tableName = process.env.TABLE_NAME, documentClient, classRepository, learningSessionRepository } = {}) {
    if (!tableName) throw new Error('TABLE_NAME is required');
    if (!classRepository) throw new Error('classRepository is required');
    this.tableName = tableName;
    this.classRepository = classRepository;
    this.learningSessionRepository = learningSessionRepository;
    this.client = documentClient || DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  }

  async access(classId, uid) { return this.classRepository.getForUser(classId, uid); }
  async requireOwner(classId, uid) {
    const access = await this.access(classId, uid);
    if (access.accessRole !== 'owner') throw forbidden('Hanya pengelola kelas yang dapat mengatur tugas.');
    return access;
  }
  async getItem(classId, taskId) {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: taskKey(classId, taskId), ConsistentRead: true }));
    if (!result.Item || result.Item.entityType !== 'TASK' || result.Item.status === 'deleted') throw notFound('Tugas tidak ditemukan.');
    return result.Item;
  }
  async getSubmission(taskId, uid) {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: submissionKey(taskId, uid), ConsistentRead: true }));
    return result.Item?.entityType === 'TASK_SUBMISSION' ? result.Item : null;
  }
  async submissionHistory(taskId, uid) {
    const result = await this.client.send(new QueryCommand({ TableName: this.tableName, KeyConditionExpression: 'PK = :task AND begins_with(SK, :revision)', ExpressionAttributeValues: { ':task': `TASK#${taskId}`, ':revision': `REVISION#${uid}#` }, ConsistentRead: true, ScanIndexForward: false, Limit: 100 }));
    return (result.Items || []).filter((item) => item.entityType === 'TASK_SUBMISSION_REVISION').map((item) => ({ previousStatus: item.previousStatus, previousScore: item.previousScore ?? null, previousFeedback: item.previousFeedback || '', previousSubmittedAt: item.previousSubmittedAt, previousAttemptNumber: item.previousAttemptNumber, createdAt: item.createdAt }));
  }
  async list(classId, uid) {
    const access = await this.access(classId, uid);
    const result = await this.client.send(new QueryCommand({ TableName: this.tableName, KeyConditionExpression: 'PK = :class AND begins_with(SK, :task)', ExpressionAttributeValues: { ':class': `CLASS#${classId}`, ':task': 'TASK#' }, ConsistentRead: true, Limit: 100 }));
    let tasks = (result.Items || []).filter((item) => item.entityType === 'TASK' && item.status !== 'deleted');
    if (access.accessRole !== 'owner') tasks = tasks.filter((item) => item.status === 'published');
    tasks.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
    if (access.accessRole === 'owner' || !tasks.length) return tasks.map((item) => summary(item, { accessRole: access.accessRole }));
    const keys = tasks.map((task) => submissionKey(task.id, uid));
    const resultSubmissions = await this.client.send(new BatchGetCommand({ RequestItems: { [this.tableName]: { Keys: keys, ConsistentRead: true } } }));
    const submissions = new Map((resultSubmissions.Responses?.[this.tableName] || []).map((item) => [item.taskId, item]));
    return tasks.map((item) => summary(item, { accessRole: 'member', submission: publicSubmission(submissions.get(item.id)) }));
  }
  async get(classId, taskId, uid) {
    const access = await this.access(classId, uid);
    const task = await this.getItem(classId, taskId);
    if (access.accessRole !== 'owner' && task.status !== 'published') throw notFound('Tugas tidak ditemukan.');
    const submission = access.accessRole === 'member' ? await this.getSubmission(taskId, uid) : null;
    const history = submission && access.accessRole === 'member' ? await this.submissionHistory(taskId, uid) : [];
    return summary(task, { accessRole: access.accessRole, ...(access.accessRole === 'member' ? { submission: publicSubmission(submission, { history }) } : {}) });
  }
  async create({ classId, ownerId, title, instructions, dueAt, responseMode, status, sessionId, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId);
    if (sessionId) {
      if (!this.learningSessionRepository) throw new Error('learningSessionRepository is required for session-linked tasks');
      await this.learningSessionRepository.requireAssignable(classId, sessionId, ownerId);
    }
    const id = randomUUID();
    const item = { ...taskKey(classId, id), entityType: 'TASK', id, classId, ownerId, title, instructions, dueAt, responseMode, status, ...(sessionId ? { sessionId } : {}), createdAt: now, updatedAt: now, ...(status === 'published' ? { publishedAt: now } : {}) };
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
    return summary(item, { accessRole: 'owner' });
  }
  async update({ classId, taskId, ownerId, title, instructions, dueAt, responseMode, status, sessionId, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId);
    const current = await this.getItem(classId, taskId);
    if (current.ownerId !== ownerId) throw forbidden('Hanya pengelola kelas yang dapat mengubah tugas.');
    if (sessionId && sessionId !== current.sessionId) await this.learningSessionRepository?.requireAssignable(classId, sessionId, ownerId);
    const item = { ...current, title, instructions, dueAt, responseMode, status, updatedAt: now, ...(sessionId ? { sessionId } : {}), ...(status === 'published' ? { publishedAt: current.publishedAt || now } : {}) };
    if (!sessionId) delete item.sessionId;
    if (status !== 'published') delete item.publishedAt;
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item, ConditionExpression: 'ownerId = :owner AND attribute_exists(PK)', ExpressionAttributeValues: { ':owner': ownerId } }));
    return summary(item, { accessRole: 'owner' });
  }
  async prepareAttachmentUpload({ classId, taskId, uid }) {
    const task = await this.requireMemberTask(classId, taskId, uid);
    if (task.responseMode === 'text') throw conflict('ATTACHMENT_NOT_ALLOWED', 'Tugas ini hanya menerima jawaban teks.');
    return task;
  }
  async requireMemberTask(classId, taskId, uid) {
    const access = await this.access(classId, uid);
    const task = await this.getItem(classId, taskId);
    if (access.accessRole !== 'member' || task.status !== 'published') throw forbidden('Pengumpulan tugas hanya tersedia untuk siswa pada tugas yang diterbitkan.');
    return task;
  }
  async submit({ classId, taskId, uid, studentName, textAnswer, attachments, now = new Date().toISOString() }) {
    const task = await this.requireMemberTask(classId, taskId, uid);
    if (task.responseMode === 'text' && !textAnswer) throw conflict('TEXT_ANSWER_REQUIRED', 'Tugas ini memerlukan jawaban teks.');
    if (task.responseMode === 'attachment' && !attachments.length) throw conflict('ATTACHMENT_REQUIRED', 'Tugas ini memerlukan minimal satu lampiran.');
    if (task.responseMode === 'both' && (!textAnswer || !attachments.length)) throw conflict('BOTH_ANSWERS_REQUIRED', 'Tugas ini memerlukan jawaban teks dan lampiran.');
    const folder = `quizzy/classes/${classId}/tasks/${taskId}/submissions/${uid}/`;
    if (attachments.some((file) => !file.publicId.startsWith(folder))) throw forbidden('Lampiran tidak sesuai dengan tugas ini.');
    const previous = await this.getSubmission(taskId, uid);
    const late = Date.parse(now) > Date.parse(task.dueAt);
    const item = { ...submissionKey(taskId, uid), entityType: 'TASK_SUBMISSION', taskId, classId, studentId: uid, studentName, textAnswer, attachments, status: late ? 'late' : 'submitted', late, submittedAt: now, attemptNumber: (previous?.attemptNumber || 0) + 1, revisionCount: (previous?.revisionCount || 0) + (previous ? 1 : 0), updatedAt: now };
    if (previous) {
      await this.client.send(new TransactWriteCommand({ TransactItems: [
        { Put: { TableName: this.tableName, Item: historyEntry(previous, now), ConditionExpression: 'attribute_not_exists(PK)' } },
        { Put: { TableName: this.tableName, Item: item } },
      ] }));
    } else await this.client.send(new PutCommand({ TableName: this.tableName, Item: item }));
    return publicSubmission(item);
  }
  async listSubmissions({ classId, taskId, ownerId }) {
    await this.requireOwner(classId, ownerId);
    const task = await this.getItem(classId, taskId);
    if (task.ownerId !== ownerId) throw forbidden('Hanya pengelola tugas yang dapat melihat pengumpulan.');
    const result = await this.client.send(new QueryCommand({ TableName: this.tableName, KeyConditionExpression: 'PK = :task AND begins_with(SK, :submission)', ExpressionAttributeValues: { ':task': `TASK#${taskId}`, ':submission': 'SUBMISSION#' }, ConsistentRead: true, Limit: 100 }));
    return (result.Items || []).filter((item) => item.entityType === 'TASK_SUBMISSION').map(publicSubmission).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  }
  async grade({ classId, taskId, studentId, ownerId, status, score, feedback, now = new Date().toISOString() }) {
    await this.requireOwner(classId, ownerId);
    const task = await this.getItem(classId, taskId);
    if (task.ownerId !== ownerId) throw forbidden('Hanya pengelola tugas yang dapat memberi nilai.');
    const current = await this.getSubmission(taskId, studentId);
    if (!current) throw notFound('Pengumpulan siswa tidak ditemukan.');
    const item = { ...current, status, ...(score === null ? {} : { score }), ...(status === 'returned' ? { returnedAt: now } : { gradedAt: now, gradedBy: ownerId }), feedback, revisionCount: (current.revisionCount || 0) + 1, updatedAt: now };
    if (status === 'returned') { delete item.gradedAt; delete item.gradedBy; }
    await this.client.send(new TransactWriteCommand({ TransactItems: [
      { Put: { TableName: this.tableName, Item: historyEntry(current, now), ConditionExpression: 'attribute_not_exists(PK)' } },
      { Put: { TableName: this.tableName, Item: item, ConditionExpression: 'attribute_exists(PK)' } },
    ] }));
    return publicSubmission(item);
  }
}
