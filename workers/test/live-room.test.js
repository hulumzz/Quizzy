import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { LiveQuizRoom } from '../src/durable/LiveQuizRoom.js';

function roomFixture() {
  const sqlite = new DatabaseSync(':memory:');
  const sql = { exec(query, ...values) {
    const statement = sqlite.prepare(query);
    if (/^SELECT\b/i.test(query)) return { toArray: () => statement.all(...values) };
    statement.run(...values);
    return { toArray: () => [] };
  } };
  const context = { storage: { sql, transactionSync(callback) { sqlite.exec('BEGIN'); try { const result = callback(); sqlite.exec('COMMIT'); return result; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } }, async setAlarm() {}, async deleteAll() {} }, blockConcurrencyWhile(callback) { return callback(); } };
  const room = new LiveQuizRoom(context, {});
  const call = async (path, input = {}) => {
    const response = await room.fetch(new Request(`https://room.internal/${path}`, { method: 'POST', body: JSON.stringify(input) }));
    return { status: response.status, ...(await response.json()) };
  };
  return { call, close: () => sqlite.close() };
}

test('live room keeps answer secret until reveal and scores one answer per participant', async (t) => {
  const room = roomFixture(); t.after(room.close);
  const initialized = await room.call('initialize', { code: 'ABC234', scope: 'class', classId: 'class-1', quizId: 'quiz-1', ownerId: 'teacher-1', title: 'Live', questionDurationSeconds: 30, questions: [{ id: 'q1', type: 'multiple_choice', prompt: 'Dua?', choices: ['1', '2'], correctAnswer: '2', points: 5, explanation: 'Dua.' }] });
  assert.equal(initialized.data.id, 'ABC234');
  assert.equal((await room.call('initialize', { code: 'ABC234' })).error.code, 'LIVE_CODE_CONFLICT');
  const joined = await room.call('join', { name: 'Ayu', ipHash: 'ip-hash' });
  assert.equal(joined.data.participant.name, 'Ayu');
  assert.equal((await room.call('host', { ownerId: 'wrong', scope: 'class', classId: 'class-1' })).status, 403);
  await room.call('advance', { ownerId: 'teacher-1', scope: 'class', classId: 'class-1', action: 'advance' });
  assert.equal((await room.call('public')).data.question.correctAnswer, undefined);
  const participant = joined.data.participant;
  const answer = await room.call('answer', { participantId: participant.id, participantToken: participant.participantToken, questionId: 'q1', answer: '2' });
  assert.equal(answer.data.accepted, true);
  assert.equal((await room.call('answer', { participantId: participant.id, participantToken: participant.participantToken, questionId: 'q1', answer: '2' })).error.code, 'LIVE_ANSWER_ALREADY_RECEIVED');
  assert.equal((await room.call('result', { participantId: participant.id, participantToken: participant.participantToken })).error.code, 'LIVE_RESULT_NOT_READY');
  await room.call('advance', { ownerId: 'teacher-1', scope: 'class', classId: 'class-1', action: 'advance' });
  assert.equal((await room.call('public')).data.question.correctAnswer, '2');
  await room.call('advance', { ownerId: 'teacher-1', scope: 'class', classId: 'class-1', action: 'advance' });
  const result = await room.call('result', { participantId: participant.id, participantToken: participant.participantToken });
  assert.equal(result.data.participant.score, 5);
  assert.equal(result.data.participant.rank, 1);
});
