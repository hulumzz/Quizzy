import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { LiveQuizRoom } from '../src/durable/LiveQuizRoom.js';

function roomFixture() {
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
  const room = new LiveQuizRoom(context, {});
  const call = async (path, input = {}) => {
    const response = await room.fetch(new Request(`https://room.internal/${path}`, { method: 'POST', body: JSON.stringify(input) }));
    return { status: response.status, ...(await response.json()) };
  };
  return { call, close: () => sqlite.close() };
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
  assert.deepEqual(arrange.items.map((item) => item.id), ['b', 'c', 'a']);
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
  assert.deepEqual(arrange.items.map((item) => item.id), ['b', 'c', 'a']);
});
