import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { conflict, forbidden, notFound } from '../http/errors.js';

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const code = () => Array.from(randomBytes(6), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
const safeQuestion = (question) => ({
  id: question.id, type: question.type, prompt: question.prompt, choices: question.choices, points: question.points,
  ...(question.type === 'arrange' ? { items: question.items } : {}),
  ...(question.imageUrl ? { imageUrl: question.imageUrl } : {}),
  ...(question.type === 'image_hotspot' ? { tolerancePercent: question.tolerancePercent, hotspots: (question.hotspots || []).map(({ id, label, x, y, width, height }) => ({ id, label, x, y, width, height })) } : {}),
});
const revealedQuestion = (question) => ({ ...safeQuestion(question), correctAnswer: question.type === 'arrange' ? question.correctOrder : question.type === 'image_hotspot' ? 'Area yang ditandai' : question.correctAnswer, explanation: question.explanation || '' });
function answerChoiceKey(question, answer) {
  if (question.type === 'multiple_choice') {
    const index = question.choices.indexOf(answer);
    return index >= 0 ? String.fromCharCode(65 + index) : 'OTHER';
  }
  if (question.type === 'true_false') return answer === true ? 'TRUE' : answer === false ? 'FALSE' : 'OTHER';
  if (question.type === 'arrange') return 'ARRANGED';
  if (question.type === 'image_hotspot') return 'HOTSPOT';
  return 'OPEN';
}
const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('id-ID');
const participantSummary = (item) => ({ id: item.id, name: item.name, joinedAt: item.joinedAt, answeredQuestionId: item.answeredQuestionId || null, score: Number(item.score || 0), correctCount: Number(item.correctCount || 0) });
const LIVE_SESSION_TTL_SECONDS = 12 * 60 * 60;
const JOIN_LIMIT_PER_MINUTE = 30;

function safeEqual(left, right) {
  const leftValue = Buffer.from(String(left));
  const rightValue = Buffer.from(String(right));
  return leftValue.length === rightValue.length && timingSafeEqual(leftValue, rightValue);
}

function correctAnswer(question, supplied) {
  if (question.type === 'true_false') return supplied === question.correctAnswer;
  if (question.type === 'arrange') return Array.isArray(supplied) && supplied.length === question.correctOrder.length && supplied.every((value, index) => value === question.correctOrder[index]);
  if (question.type === 'image_hotspot') {
    if (!supplied || typeof supplied !== 'object' || !Number.isFinite(supplied.x) || !Number.isFinite(supplied.y)) return false;
    const area = (question.hotspots || []).find((spot) => spot.correct);
    const margin = Number(question.tolerancePercent || 0);
    return Boolean(area) && supplied.x >= area.x - margin && supplied.x <= area.x + area.width + margin && supplied.y >= area.y - margin && supplied.y <= area.y + area.height + margin;
  }
  return normalize(supplied) === normalize(question.correctAnswer);
}

function leaderboard(participants) {
  return participants.map(participantSummary).sort((left, right) => right.score - left.score || right.correctCount - left.correctCount || left.joinedAt.localeCompare(right.joinedAt)).map((item, index) => ({ ...item, rank: index + 1 }));
}

export class LiveQuizRepository {
  constructor({ tableName = process.env.TABLE_NAME, documentClient, quizRepository, generalQuizRepository } = {}) {
    if (!tableName) throw new Error('TABLE_NAME is required');
    if (!quizRepository) throw new Error('quizRepository is required');
    this.tableName = tableName;
    this.quizRepository = quizRepository;
    this.generalQuizRepository = generalQuizRepository;
    this.client = documentClient || DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
  }

  async getSession(sessionId) {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK: `LIVE_SESSION#${sessionId}`, SK: 'META' }, ConsistentRead: true }));
    if (!result.Item) throw notFound('Sesi kuis tidak ditemukan.');
    return result.Item;
  }

  async getByCode(joinCode) {
    const lookup = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK: `LIVE_CODE#${joinCode}`, SK: 'LOOKUP' }, ConsistentRead: true }));
    if (!lookup.Item?.sessionId) throw notFound('Kode kuis tidak ditemukan atau sudah berakhir.');
    const session = await this.getSession(lookup.Item.sessionId);
    if (session.expiresAt && session.expiresAt <= Math.floor(Date.now() / 1000)) throw notFound('Kode kuis sudah kedaluwarsa.');
    return session;
  }

  async limitJoin(sourceIp, now = new Date()) {
    const minute = Math.floor(now.getTime() / 60000);
    const clientKey = createHash('sha256').update(String(sourceIp || 'unknown')).digest('base64url');
    try {
      await this.client.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `LIVE_RATE#${clientKey}`, SK: `JOIN#${minute}` },
        UpdateExpression: 'ADD #count :one SET expiresAt = :expiresAt',
        ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit',
        ExpressionAttributeNames: { '#count': 'count' },
        ExpressionAttributeValues: { ':one': 1, ':limit': JOIN_LIMIT_PER_MINUTE, ':expiresAt': Math.floor(now.getTime() / 1000) + 3600 },
      }));
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') throw conflict('LIVE_JOIN_RATE_LIMITED', 'Terlalu banyak percobaan gabung. Coba lagi sebentar lagi.');
      throw error;
    }
  }

  async create({ classId, quizId, ownerId, scope = 'class', questionDurationSeconds, now = new Date().toISOString() }) {
    let quiz;
    if (scope === 'general') {
      if (!this.generalQuizRepository) throw new Error('generalQuizRepository is required');
      quiz = await this.generalQuizRepository.get(ownerId, quizId);
    } else {
      await this.quizRepository.requireOwner(classId, ownerId);
      quiz = await this.quizRepository.getItem(classId, quizId);
    }
    if (quiz.status !== 'published') throw conflict('QUIZ_NOT_PUBLISHED', 'Terbitkan kuis sebelum memulai sesi live.');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = randomUUID();
      const joinCode = code();
      const expiresAt = Math.floor(new Date(now).getTime() / 1000) + LIVE_SESSION_TTL_SECONDS;
      const item = {
        PK: `LIVE_SESSION#${id}`, SK: 'META', entityType: 'LIVE_QUIZ_SESSION', id, joinCode, scope, ...(scope === 'class' ? { classId } : {}), quizId, ownerId,
        title: quiz.title, questionDurationSeconds, questions: quiz.questions, phase: 'lobby', currentQuestionIndex: -1,
        stateVersion: 1, participantsCount: 0, currentAnsweredCount: 0, currentCorrectCount: 0, currentOptionCounts: {}, expiresAt, createdAt: now, updatedAt: now,
      };
      try {
        await this.client.send(new TransactWriteCommand({ TransactItems: [
          { Put: { TableName: this.tableName, Item: item, ConditionExpression: 'attribute_not_exists(PK)' } },
          { Put: { TableName: this.tableName, Item: { PK: `LIVE_CODE#${joinCode}`, SK: 'LOOKUP', entityType: 'LIVE_CODE', sessionId: id, expiresAt, createdAt: now }, ConditionExpression: 'attribute_not_exists(PK)' } },
        ] }));
        return this.hostState(item, []);
      } catch (error) {
        if (!['TransactionCanceledException', 'ConditionalCheckFailedException'].includes(error?.name)) throw error;
      }
    }
    throw conflict('LIVE_CODE_CONFLICT', 'Kode kuis belum dapat dibuat. Silakan coba lagi.');
  }

  publicState(item) {
    const currentQuestion = item.currentQuestionIndex >= 0 ? item.questions[item.currentQuestionIndex] : null;
    const activeQuestion = currentQuestion ? item.phase === 'reveal' ? revealedQuestion(currentQuestion) : safeQuestion(currentQuestion) : null;
    return { sessionId: item.id, code: item.joinCode, title: item.title, phase: item.phase, questionIndex: item.currentQuestionIndex, questionCount: item.questions.length, question: activeQuestion, startedAt: item.startedAt || null, endsAt: item.endsAt || null, stateVersion: item.stateVersion, participantCount: item.participantsCount || 0, answeredCount: item.currentAnsweredCount || 0 };
  }

  hostState(item, participants) {
    const participantList = participants.map(participantSummary);
    return { ...this.publicState(item), questionDurationSeconds: item.questionDurationSeconds, optionCounts: item.currentOptionCounts || {}, correctCount: item.currentCorrectCount || 0, participants: participantList, ...(item.phase === 'finished' ? { leaderboard: leaderboard(participants) } : {}) };
  }

  async publicStateByCode(joinCode) { return this.publicState(await this.getByCode(joinCode)); }

  async hostStateById(sessionId, ownerId) {
    const item = await this.getSession(sessionId);
    if (item.ownerId !== ownerId) throw forbidden('Hanya host yang dapat melihat sesi ini.');
    return this.hostState(item, await this.listParticipants(item));
  }

  async listParticipants(session) {
    const result = await this.client.send(new QueryCommand({ TableName: this.tableName, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :participant)', ExpressionAttributeValues: { ':pk': session.PK, ':participant': 'PARTICIPANT#' }, Limit: 100 }));
    return result.Items || [];
  }

  async join({ joinCode, name, sourceIp, now = new Date().toISOString() }) {
    await this.limitJoin(sourceIp, new Date(now));
    const item = await this.getByCode(joinCode);
    if (!['lobby', 'countdown'].includes(item.phase)) throw conflict('LIVE_JOIN_CLOSED', 'Sesi sudah dimulai atau telah berakhir.');
    const id = randomUUID();
    const participantToken = randomBytes(32).toString('hex');
    const participant = { PK: item.PK, SK: `PARTICIPANT#${id}`, entityType: 'LIVE_QUIZ_PARTICIPANT', id, name, participantToken, score: 0, correctCount: 0, expiresAt: item.expiresAt, joinedAt: now };
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: [
        { Put: { TableName: this.tableName, Item: participant, ConditionExpression: 'attribute_not_exists(PK)' } },
        { Update: { TableName: this.tableName, Key: { PK: item.PK, SK: 'META' }, UpdateExpression: 'SET updatedAt = :now ADD participantsCount :one', ConditionExpression: '#phase IN (:lobby, :countdown)', ExpressionAttributeNames: { '#phase': 'phase' }, ExpressionAttributeValues: { ':now': now, ':one': 1, ':lobby': 'lobby', ':countdown': 'countdown' } } },
      ] }));
    } catch (error) {
      if (['TransactionCanceledException', 'ConditionalCheckFailedException'].includes(error?.name)) throw conflict('LIVE_JOIN_CLOSED', 'Sesi sudah dimulai atau telah berakhir.');
      throw error;
    }
    return { participant: { id, name, participantToken }, state: await this.publicStateByCode(joinCode) };
  }

  async advance({ sessionId, ownerId, action, now = new Date().toISOString() }) {
    const current = await this.getSession(sessionId);
    if (current.ownerId !== ownerId) throw forbidden('Hanya host yang dapat mengatur sesi ini.');
    let phase = current.phase;
    let currentQuestionIndex = current.currentQuestionIndex;
    let currentAnsweredCount = current.currentAnsweredCount || 0;
    let currentCorrectCount = current.currentCorrectCount || 0;
    let currentOptionCounts = current.currentOptionCounts || {};
    let startedAt = current.startedAt || null;
    let endsAt = current.endsAt || null;
    if (action === 'finish') phase = 'finished';
    else if (phase === 'lobby' || phase === 'countdown' || phase === 'reveal') {
      if (currentQuestionIndex >= current.questions.length - 1 && phase === 'reveal') phase = 'finished';
      else { phase = 'question'; currentQuestionIndex += 1; currentAnsweredCount = 0; currentCorrectCount = 0; currentOptionCounts = {}; startedAt = now; endsAt = new Date(new Date(now).getTime() + current.questionDurationSeconds * 1000).toISOString(); }
    } else if (phase === 'question') { phase = 'reveal'; endsAt = now; }
    else throw conflict('LIVE_SESSION_FINISHED', 'Sesi ini sudah selesai.');
    const item = { ...current, phase, currentQuestionIndex, currentAnsweredCount, currentCorrectCount, currentOptionCounts, startedAt, endsAt, stateVersion: (current.stateVersion || 0) + 1, updatedAt: now };
    try {
      await this.client.send(new PutCommand({ TableName: this.tableName, Item: item, ConditionExpression: 'ownerId = :owner AND stateVersion = :version', ExpressionAttributeValues: { ':owner': ownerId, ':version': current.stateVersion } }));
    } catch (error) {
      if (error?.name === 'ConditionalCheckFailedException') throw conflict('LIVE_STATE_CHANGED', 'Status sesi baru saja berubah. Coba lagi.');
      throw error;
    }
    return this.hostState(item, phase === 'finished' ? await this.listParticipants(item) : []);
  }

  async authorizeAnswer({ joinCode, participantId, participantToken, questionId, answer, now = new Date().toISOString() }) {
    const session = await this.getByCode(joinCode);
    if (session.phase !== 'question' || session.currentQuestionIndex < 0) throw conflict('LIVE_QUESTION_NOT_OPEN', 'Belum ada soal yang dapat dijawab.');
    if (new Date(session.endsAt).getTime() < new Date(now).getTime()) throw conflict('LIVE_QUESTION_LOCKED', 'Waktu untuk menjawab sudah habis.');
    const question = session.questions[session.currentQuestionIndex];
    if (question.id !== questionId) throw conflict('LIVE_QUESTION_CHANGED', 'Soal sudah berganti.');
    const participant = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK: session.PK, SK: `PARTICIPANT#${participantId}` }, ConsistentRead: true }));
    if (!participant.Item || !safeEqual(participant.Item.participantToken, participantToken)) throw forbidden('Sesi peserta tidak valid.');
    return { sessionId: session.id, participantId, questionId, questionIndex: session.currentQuestionIndex, answer, acceptedAt: now };
  }

  async processQueuedAnswer({ sessionId, participantId, questionId, questionIndex, answer, acceptedAt }) {
    if (typeof sessionId !== 'string' || typeof participantId !== 'string' || typeof questionId !== 'string' || !Number.isInteger(questionIndex)) throw notFound('Pesan jawaban tidak valid.');
    const session = await this.getSession(sessionId);
    if (session.phase !== 'question' || session.currentQuestionIndex !== questionIndex || session.questions[questionIndex]?.id !== questionId) throw conflict('LIVE_QUESTION_CHANGED', 'Soal sudah berganti.');
    if (new Date(session.endsAt).getTime() < new Date(acceptedAt).getTime()) throw conflict('LIVE_QUESTION_LOCKED', 'Waktu untuk menjawab sudah habis.');
    const question = session.questions[questionIndex];
    const choiceKey = answerChoiceKey(question, answer);
    const correct = correctAnswer(question, answer);
    const earnedPoints = correct ? Number(question.points || 0) : 0;
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: [
        { Update: { TableName: this.tableName, Key: { PK: session.PK, SK: 'META' }, UpdateExpression: 'SET updatedAt = :now, currentOptionCounts.#choice = if_not_exists(currentOptionCounts.#choice, :zero) + :one ADD currentAnsweredCount :one, currentCorrectCount :correct', ConditionExpression: '#phase = :phase AND currentQuestionIndex = :index AND endsAt >= :now', ExpressionAttributeNames: { '#phase': 'phase', '#choice': choiceKey }, ExpressionAttributeValues: { ':now': acceptedAt, ':zero': 0, ':one': 1, ':correct': correct ? 1 : 0, ':phase': 'question', ':index': questionIndex } } },
        { Put: { TableName: this.tableName, Item: { PK: session.PK, SK: `ANSWER#${questionId}#${participantId}`, entityType: 'LIVE_QUIZ_ANSWER', participantId, questionId, answer, correct, earnedPoints, expiresAt: session.expiresAt, answeredAt: acceptedAt }, ConditionExpression: 'attribute_not_exists(PK)' } },
        { Update: { TableName: this.tableName, Key: { PK: session.PK, SK: `PARTICIPANT#${participantId}` }, UpdateExpression: 'SET answeredQuestionId = :questionId, answeredAt = :now ADD score :points, correctCount :correct', ConditionExpression: 'attribute_exists(PK)', ExpressionAttributeValues: { ':questionId': questionId, ':now': acceptedAt, ':points': earnedPoints, ':correct': correct ? 1 : 0 } } },
      ] }));
    } catch (error) {
      if (['TransactionCanceledException', 'ConditionalCheckFailedException'].includes(error?.name)) throw conflict('LIVE_ANSWER_ALREADY_RECEIVED', 'Jawaban untuk soal ini sudah diterima atau sudah terkunci.');
      throw error;
    }
    return { accepted: true, questionId, answeredAt: acceptedAt };
  }

  async participantResult({ joinCode, participantId, participantToken }) {
    const session = await this.getByCode(joinCode);
    if (session.phase !== 'finished') throw conflict('LIVE_RESULT_NOT_READY', 'Hasil tersedia setelah host mengakhiri sesi.');
    const found = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK: session.PK, SK: `PARTICIPANT#${participantId}` }, ConsistentRead: true }));
    if (!found.Item || !safeEqual(found.Item.participantToken, participantToken)) throw forbidden('Sesi peserta tidak valid.');
    const ranking = leaderboard(await this.listParticipants(session));
    const participant = ranking.find((item) => item.id === participantId);
    if (!participant) throw notFound('Peserta tidak ditemukan.');
    const totalPoints = session.questions.reduce((total, question) => total + Number(question.points || 0), 0);
    return { sessionId: session.id, title: session.title, participant, totalPoints, questionCount: session.questions.length };
  }
}
