import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { LiveQuizRoom } from '../src/durable/LiveQuizRoom.js';

function roomFixture(env = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const sql = { exec(query, ...values) {
    const statement = sqlite.prepare(query);
    if (/^(SELECT|PRAGMA)\b/i.test(query.trim())) return { toArray: () => statement.all(...values) };
    statement.run(...values);
    return { toArray: () => [] };
  } };
  const context = {
    storage: {
      sql,
      transactionSync(callback) {
        sqlite.exec('BEGIN');
        try { const result = callback(); sqlite.exec('COMMIT'); return result; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      },
      async setAlarm() {},
      async deleteAll() {},
    },
    blockConcurrencyWhile(callback) { return callback(); },
  };
  const room = new LiveQuizRoom(context, env);
  const call = async (path, input = {}) => {
    const response = await room.fetch(new Request(`https://room.internal/${path}`, { method: 'POST', body: JSON.stringify(input) }));
    return { status: response.status, ...(await response.json()) };
  };
  return { call, room, context, sqlite, close: () => sqlite.close() };
}

test('live room keeps answer secret until reveal and scores one answer per participant', async (t) => {
  const room = roomFixture(); t.after(room.close);
  const initialized = await room.call('initialize', {
    code: 'ABC234', scope: 'class', classId: 'class-1', quizId: 'quiz-1', ownerId: 'teacher-1', title: 'Live',
    questionDurationSeconds: 30,
    questions: [{ id: 'q1', type: 'multiple_choice', prompt: 'Dua?', choices: ['1', '2'], correctAnswer: '2', points: 5, explanation: 'Dua.' }],
  });
  assert.equal(initialized.data.id, 'ABC234');
  assert.equal(initialized.data.questionDurationSeconds, 30);
  assert.equal((await room.call('initialize', { code: 'ABC234' })).error.code, 'LIVE_CODE_CONFLICT');

  const joined = await room.call('join', { name: 'Ayu', ipHash: 'ip-hash', studentId: 'student-1' });
  assert.equal(joined.data.participant.name, 'Ayu');
  assert.equal(joined.data.participant.participantId, joined.data.participant.id);
  assert.equal((await room.call('host', { ownerId: 'wrong', scope: 'class', classId: 'class-1' })).status, 403);

  const ticket = await room.call('socket-ticket', { ownerId: 'teacher-1', scope: 'class', classId: 'class-1' });
  assert.match(ticket.data.ticket, /^[a-f0-9]{64}$/);
  assert.ok(ticket.data.expiresAt > Date.now());

  await room.call('advance', { ownerId: 'teacher-1', scope: 'class', classId: 'class-1', action: 'advance' });
  assert.equal((await room.call('public')).data.question.correctAnswer, undefined);
  const participant = joined.data.participant;
  const answer = await room.call('answer', { participantId: participant.participantId, participantToken: participant.participantToken, questionId: 'q1', answer: '2' });
  assert.equal(answer.data.accepted, true);
  assert.equal((await room.call('answer', { participantId: participant.participantId, participantToken: participant.participantToken, questionId: 'q1', answer: '2' })).error.code, 'LIVE_ANSWER_ALREADY_RECEIVED');
  assert.equal((await room.call('result', { participantId: participant.participantId, participantToken: participant.participantToken })).error.code, 'LIVE_RESULT_NOT_READY');

  await room.call('advance', { ownerId: 'teacher-1', scope: 'class', classId: 'class-1', action: 'advance' });
  assert.equal((await room.call('public')).data.question.correctAnswer, '2');
  const finished = await room.call('advance', { ownerId: 'teacher-1', scope: 'class', classId: 'class-1', action: 'advance' });
  assert.equal(finished.data.phase, 'finished');
  assert.equal(finished.data.persistenceStatus, 'unavailable');

  const result = await room.call('result', { participantId: participant.participantId, participantToken: participant.participantToken });
  assert.equal(result.data.participant.score, 5);
  assert.equal(result.data.participant.rank, 1);
  assert.equal(result.data.participant.studentId, 'student-1');
});

const setup = { code: 'ABC234', scope: 'class', classId: 'class-1', quizId: 'quiz-1', ownerId: 'teacher-1', title: 'Live', questionDurationSeconds: 30,
  questions: [{ id: 'q1', type: 'true_false', prompt: 'Benar?', correctAnswer: true, points: 5 }] };
const host = { ownerId: 'teacher-1', scope: 'class', classId: 'class-1', action: 'advance' };

test('participant state restores answer lock without disclosing correctness before reveal', async (t) => {
  const fixture = roomFixture(); t.after(fixture.close);
  await fixture.call('initialize', setup);
  const { participant } = (await fixture.call('join', { name: 'Siswa', ipHash: 'ip', studentId: 'student-1' })).data;
  await fixture.call('advance', host);
  await fixture.call('answer', { ...participant, questionId: 'q1', answer: true });
  const active = (await fixture.call('participant', participant)).data;
  assert.equal(active.receipt.accepted, true);
  assert.equal(active.receipt.correct, undefined);
  assert.equal(active.receipt.earnedPoints, undefined);
  assert.equal((await fixture.call('public')).data.receipt, undefined);
  await fixture.call('advance', host);
  assert.equal((await fixture.call('participant', participant)).data.receipt.earnedPoints, 5);
  const reconnect = (await fixture.call('join', { name: 'Siswa', ipHash: 'ip', studentId: 'student-1' })).data;
  assert.equal(reconnect.participant.id, participant.id);
  assert.equal(reconnect.state.participantCount, 1);
  assert.equal((await fixture.call('participant', participant)).status, 403);
});

test('server alarm reveals an expired question while host is offline and rejects stale advances', async (t) => {
  const fixture = roomFixture(); t.after(fixture.close);
  await fixture.call('initialize', setup);
  await fixture.call('advance', host);
  const state = fixture.room.load(); state.endsAt = new Date(Date.now() - 1).toISOString(); fixture.room.save(state);
  await fixture.room.alarm();
  assert.equal(fixture.room.load().phase, 'reveal');
  const stale = await fixture.call('advance', { ...host, expectedPhase: 'question', expectedQuestionIndex: 0 });
  assert.equal(stale.error.code, 'LIVE_STATE_CHANGED');
});

test('failed D1 persistence retains finished room beyond TTL for retry', async (t) => {
  const fixture = roomFixture({ DB: { prepare() { throw new Error('test D1 outage'); } } }); t.after(fixture.close);
  await fixture.call('initialize', setup);
  await fixture.call('advance', { ...host, action: 'finish' });
  const state = fixture.room.load(); state.expiresAt = Date.now() - 1; fixture.room.save(state);
  let deleted = false; fixture.context.storage.deleteAll = async () => { deleted = true; };
  await fixture.room.alarm();
  assert.equal(deleted, false);
  assert.equal(fixture.room.load().persistenceStatus, 'failed');
  assert.ok(fixture.room.load().expiresAt > Date.now());
});

test('authenticated student reconnect reuses participant instead of duplicating class analytics identity', async (t) => {
  const room = roomFixture(); t.after(room.close);
  await room.call('initialize', {
    code: 'CDE456', scope: 'class', classId: 'class-1', quizId: 'quiz-1', ownerId: 'teacher-1', title: 'Reconnect',
    questionDurationSeconds: 30,
    questions: [{ id: 'q1', type: 'true_false', prompt: 'Benar?', choices: [], correctAnswer: true, points: 1 }],
  });
  const first = await room.call('join', { name: 'Ayu', ipHash: 'ip-1', studentId: 'student-1' });
  const second = await room.call('join', { name: 'Ayu Baru', ipHash: 'ip-2', studentId: 'student-1' });
  assert.equal(second.data.participant.participantId, first.data.participant.participantId);
  assert.notEqual(second.data.participant.participantToken, first.data.participant.participantToken);
  assert.equal(second.data.state.participantCount, 1);
});

test('live room never exposes hotspot geometry or arrange answer order', async (t) => {
  const room = roomFixture(); t.after(room.close);
  await room.call('initialize', {
    code: 'BCD345', scope: 'class', classId: 'class-1', quizId: 'quiz-2', ownerId: 'teacher-1', title: 'Private answers', questionDurationSeconds: 30,
    questions: [
      { id: 'hot', type: 'image_hotspot', prompt: 'Klik target', imageUrl: 'https://example.com/a.png', points: 1, tolerancePercent: 2, hotspots: [{ id: 'h1', label: 'Target', x: 10, y: 10, width: 20, height: 20, correct: true }] },
      { id: 'arr', type: 'arrange', prompt: 'Urutkan', points: 1, items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }], correctOrder: ['a', 'b', 'c'] },
    ],
  });
  await room.call('advance', { ownerId: 'teacher-1', scope: 'class', classId: 'class-1', action: 'advance' });
  const hotspot = (await room.call('public')).data.question;
  assert.equal(hotspot.hotspots, undefined);
  assert.equal(hotspot.tolerancePercent, undefined);

  await room.call('advance', { ownerId: 'teacher-1', scope: 'class', classId: 'class-1', action: 'advance' });
  await room.call('advance', { ownerId: 'teacher-1', scope: 'class', classId: 'class-1', action: 'advance' });
  const arrange = (await room.call('public')).data.question;
  assert.deepEqual(arrange.items.map((item) => item.id).sort(), ['a', 'b', 'c']);
});
