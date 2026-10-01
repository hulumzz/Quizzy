import { conflict, forbidden, HttpError, notFound } from '../http/errors.js';

const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const liveCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => alphabet[byte % alphabet.length]).join('');
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
const equalToken = (left, right) => {
  const a = String(left || ''); const b = String(right || ''); let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
};
const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('id-ID');
function publicArrangeItems(q) {
  const items = [...(q.items || [])];
  if (items.length < 2) return items;
  const correctOrder = Array.isArray(q.correctOrder) ? q.correctOrder : [];
  const exposesCorrectOrder = correctOrder.length === items.length && items.every((item, index) => item.id === correctOrder[index]);
  return exposesCorrectOrder ? [...items.slice(1), items[0]] : items;
}
const safeQuestion = (q) => ({ id: q.id, type: q.type, prompt: q.prompt, choices: q.choices, points: q.points,
  ...(q.type === 'arrange' ? { items: publicArrangeItems(q) } : {}), ...(q.imageUrl ? { imageUrl: q.imageUrl } : {}) });
const revealedQuestion = (q) => ({ ...safeQuestion(q), correctAnswer: q.type === 'arrange' ? q.correctOrder : q.type === 'image_hotspot' ? 'Area yang ditandai' : q.correctAnswer, explanation: q.explanation || '' });
function correct(q, answer) {
  if (q.type === 'true_false') return answer === q.correctAnswer;
  if (q.type === 'arrange') return Array.isArray(answer) && answer.length === q.correctOrder.length && answer.every((value, index) => value === q.correctOrder[index]);
  if (q.type === 'image_hotspot') { const area = q.hotspots.find((spot) => spot.correct); const margin = q.tolerancePercent || 0; return Boolean(area && answer && Number.isFinite(answer.x) && Number.isFinite(answer.y) && answer.x >= area.x - margin && answer.x <= area.x + area.width + margin && answer.y >= area.y - margin && answer.y <= area.y + area.height + margin); }
  return normalize(answer) === normalize(q.correctAnswer);
}
function choiceKey(q, answer) {
  if (q.type === 'multiple_choice') { const index = q.choices.indexOf(answer); return index >= 0 ? String.fromCharCode(65 + index) : 'OTHER'; }
  if (q.type === 'true_false') return answer === true ? 'TRUE' : answer === false ? 'FALSE' : 'OTHER';
  if (q.type === 'arrange') return 'ARRANGED';
  if (q.type === 'image_hotspot') return 'HOTSPOT';
  return 'OPEN';
}
const participantSummary = (row) => ({ id: row.id, name: row.name, joinedAt: row.joined_at, answeredQuestionId: row.answered_question_id || null, score: row.score, correctCount: row.correct_count });
const leaderboard = (rows) => rows.map(participantSummary).sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.joinedAt.localeCompare(b.joinedAt)).map((row, index) => ({ ...row, rank: index + 1 }));

export class LiveQuizRoom {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    ctx.blockConcurrencyWhile(async () => this.ensureSchema());
  }
  ensureSchema() {
    if (this.schemaReady) return;
    const sql = this.ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS room(id TEXT PRIMARY KEY, data_json TEXT NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS participants(id TEXT PRIMARY KEY, name TEXT NOT NULL, token TEXT NOT NULL, score INTEGER NOT NULL DEFAULT 0, correct_count INTEGER NOT NULL DEFAULT 0, joined_at TEXT NOT NULL, answered_question_id TEXT)');
    sql.exec('CREATE TABLE IF NOT EXISTS answers(question_id TEXT NOT NULL, participant_id TEXT NOT NULL, answer_json TEXT NOT NULL, choice_key TEXT NOT NULL, correct INTEGER NOT NULL, earned_points INTEGER NOT NULL, answered_at TEXT NOT NULL, PRIMARY KEY(question_id,participant_id))');
    sql.exec('CREATE TABLE IF NOT EXISTS join_rates(bucket TEXT PRIMARY KEY, count INTEGER NOT NULL)');
    this.schemaReady = true;
  }
  sql(query, ...values) { return this.ctx.storage.sql.exec(query, ...values); }
  one(query, ...values) { return this.sql(query, ...values).toArray()[0] || null; }
  load() {
    const row = this.one('SELECT data_json FROM room LIMIT 1');
    if (!row) throw notFound('Kode kuis tidak ditemukan atau sudah berakhir.');
    const state = JSON.parse(row.data_json);
    if (state.expiresAt <= Date.now()) throw notFound('Kode kuis sudah kedaluwarsa.');
    return state;
  }
  save(state) { this.sql('UPDATE room SET data_json=?1 WHERE id=?2', JSON.stringify(state), state.id); }
  people() { return this.sql('SELECT * FROM participants ORDER BY joined_at ASC').toArray(); }
  publicState(state) {
    const question = state.questionIndex >= 0 ? state.questions[state.questionIndex] : null;
    return { id: state.id, sessionId: state.id, code: state.code, title: state.title, phase: state.phase,
      questionIndex: state.questionIndex, questionCount: state.questions.length,
      question: question ? state.phase === 'reveal' ? revealedQuestion(question) : safeQuestion(question) : null,
      startedAt: state.startedAt, endsAt: state.endsAt, stateVersion: state.stateVersion,
      questionDurationSeconds: state.questionDurationSeconds,
      participantCount: state.participantCount, answeredCount: state.answeredCount };
  }
  hostState(state) {
    const people = this.people();
    return { ...this.publicState(state), questionDurationSeconds: state.questionDurationSeconds,
      optionCounts: state.optionCounts, correctCount: state.correctCount,
      participants: people.map(participantSummary), ...(state.phase === 'finished' ? { leaderboard: leaderboard(people) } : {}) };
  }
  requireHost(state, { ownerId, classId, scope }) {
    if (state.ownerId !== ownerId || state.scope !== scope || (scope === 'class' && state.classId !== classId)) throw forbidden('Hanya host yang dapat melihat sesi ini.');
  }
  requireParticipant({ participantId, participantToken }) {
    const person = this.one('SELECT * FROM participants WHERE id=?1', participantId);
    if (!person || !equalToken(person.token, participantToken)) throw forbidden('Sesi peserta tidak valid.');
    return person;
  }
  async initialize(input) {
    if (this.one('SELECT id FROM room LIMIT 1')) throw conflict('LIVE_CODE_CONFLICT', 'Kode kuis sudah digunakan.');
    const now = new Date().toISOString();
    const state = { id: input.code, code: input.code, scope: input.scope, classId: input.classId || null,
      quizId: input.quizId, ownerId: input.ownerId, title: input.title, questions: input.questions,
      questionDurationSeconds: input.questionDurationSeconds, phase: 'lobby', questionIndex: -1,
      stateVersion: 1, participantCount: 0, answeredCount: 0, correctCount: 0, optionCounts: {},
      startedAt: null, endsAt: null, expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      createdAt: now, updatedAt: now };
    this.sql('INSERT INTO room(id,data_json) VALUES(?1,?2)', state.id, JSON.stringify(state));
    await this.ctx.storage.setAlarm(state.expiresAt);
    return this.hostState(state);
  }
  join({ name, ipHash }) {
    const state = this.load();
    if (!['lobby', 'countdown'].includes(state.phase)) throw conflict('LIVE_JOIN_CLOSED', 'Sesi sudah dimulai atau telah berakhir.');
    const bucket = `${ipHash}:${Math.floor(Date.now() / 60_000)}`;
    const attempts = this.one('SELECT count FROM join_rates WHERE bucket=?1', bucket)?.count || 0;
    if (attempts >= 30) throw conflict('LIVE_JOIN_RATE_LIMITED', 'Terlalu banyak percobaan gabung. Coba lagi sebentar lagi.');
    const id = crypto.randomUUID(); const participantToken = token(); const joinedAt = new Date().toISOString();
    this.ctx.storage.transactionSync(() => {
      this.sql('INSERT INTO join_rates(bucket,count) VALUES(?1,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1', bucket);
      this.sql('INSERT INTO participants(id,name,token,joined_at) VALUES(?1,?2,?3,?4)', id, name, participantToken, joinedAt);
      state.participantCount += 1; state.updatedAt = joinedAt; this.save(state);
    });
    return { participant: { id, name, participantToken }, state: this.publicState(state) };
  }
  advance(input) {
    const state = this.load(); this.requireHost(state, input);
    const now = new Date().toISOString();
    if (state.phase === 'finished') throw conflict('LIVE_SESSION_FINISHED', 'Sesi ini sudah selesai.');
    if (input.action === 'finish' || (state.phase === 'reveal' && state.questionIndex >= state.questions.length - 1)) state.phase = 'finished';
    else if (['lobby', 'countdown', 'reveal'].includes(state.phase)) {
      state.phase = 'question'; state.questionIndex += 1; state.answeredCount = 0; state.correctCount = 0;
      state.optionCounts = {}; state.startedAt = now;
      state.endsAt = new Date(Date.now() + state.questionDurationSeconds * 1000).toISOString();
    } else if (state.phase === 'question') { state.phase = 'reveal'; state.endsAt = now; }
    state.stateVersion += 1; state.updatedAt = now; this.save(state);
    return this.hostState(state);
  }
  answer(input) {
    const state = this.load();
    if (state.phase !== 'question' || state.questionIndex < 0) throw conflict('LIVE_QUESTION_NOT_OPEN', 'Belum ada soal yang dapat dijawab.');
    if (Date.parse(state.endsAt) < Date.now()) throw conflict('LIVE_QUESTION_LOCKED', 'Waktu untuk menjawab sudah habis.');
    const q = state.questions[state.questionIndex];
    if (q.id !== input.questionId) throw conflict('LIVE_QUESTION_CHANGED', 'Soal sudah berganti.');
    this.requireParticipant(input);
    if (this.one('SELECT 1 FROM answers WHERE question_id=?1 AND participant_id=?2', q.id, input.participantId)) throw conflict('LIVE_ANSWER_ALREADY_RECEIVED', 'Jawaban untuk soal ini sudah diterima.');
    const isCorrect = correct(q, input.answer); const earned = isCorrect ? Number(q.points || 0) : 0;
    const key = choiceKey(q, input.answer); const answeredAt = new Date().toISOString();
    this.ctx.storage.transactionSync(() => {
      this.sql('INSERT INTO answers(question_id,participant_id,answer_json,choice_key,correct,earned_points,answered_at) VALUES(?1,?2,?3,?4,?5,?6,?7)', q.id, input.participantId, JSON.stringify(input.answer), key, isCorrect ? 1 : 0, earned, answeredAt);
      this.sql('UPDATE participants SET score=score+?2,correct_count=correct_count+?3,answered_question_id=?4 WHERE id=?1', input.participantId, earned, isCorrect ? 1 : 0, q.id);
      state.answeredCount += 1; if (isCorrect) state.correctCount += 1;
      state.optionCounts[key] = (state.optionCounts[key] || 0) + 1; state.updatedAt = answeredAt; this.save(state);
    });
    return { accepted: true, questionId: q.id, answeredAt };
  }
  result(input) {
    const state = this.load();
    if (state.phase !== 'finished') throw conflict('LIVE_RESULT_NOT_READY', 'Hasil tersedia setelah host mengakhiri sesi.');
    this.requireParticipant(input);
    const ranked = leaderboard(this.people());
    return { sessionId: state.id, title: state.title, participant: ranked.find((person) => person.id === input.participantId),
      totalPoints: state.questions.reduce((total, q) => total + Number(q.points || 0), 0), questionCount: state.questions.length };
  }
  async alarm() {
    this.ensureSchema();
    const row = this.one('SELECT data_json FROM room LIMIT 1');
    if (row) {
      const state = JSON.parse(row.data_json);
      if (state.expiresAt > Date.now()) { await this.ctx.storage.setAlarm(state.expiresAt); return; }
    }
    await this.ctx.storage.deleteAll();
    this.schemaReady = false;
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    try {
      this.ensureSchema();
      if (path === '/health') return Response.json({ data: { status: 'ready' } });
      const input = await request.json();
      const value = path === '/initialize' ? await this.initialize(input)
        : path === '/public' ? this.publicState(this.load())
          : path === '/host' ? (() => { const state = this.load(); this.requireHost(state, input); return this.hostState(state); })()
            : path === '/join' ? this.join(input)
              : path === '/advance' ? this.advance(input)
                : path === '/answer' ? this.answer(input)
                  : path === '/result' ? this.result(input) : null;
      if (value === null) throw notFound('Rute ruang kuis tidak ditemukan.');
      return Response.json({ data: value }, { status: path === '/join' || path === '/initialize' ? 201 : 200 });
    } catch (error) {
      const known = error instanceof HttpError ? error : new HttpError(500, 'INTERNAL_ERROR', 'Ruang kuis sedang mengalami gangguan.');
      if (!(error instanceof HttpError)) console.error('Live room error', { name: error?.name, message: error?.message });
      return Response.json({ error: { code: known.code, message: known.message } }, { status: known.status });
    }
  }
}
