import assert from 'node:assert/strict';
import test from 'node:test';
import { LiveQuizAnswerQueue } from '../src/services/live-quiz-answer-queue.js';

test('answer queue sends only the validated event payload to its configured queue', async () => {
  const calls = [];
  const queue = new LiveQuizAnswerQueue({ queueUrl: 'https://sqs.example/queue', client: { async send(command) { calls.push(command); } } });
  await queue.enqueue({ sessionId: 'session-1', participantId: 'participant-1', questionId: 'q-1', questionIndex: 0, answer: 'A', acceptedAt: '2026-09-23T00:00:00.000Z' });
  assert.equal(calls[0].input.QueueUrl, 'https://sqs.example/queue');
  assert.deepEqual(JSON.parse(calls[0].input.MessageBody), { sessionId: 'session-1', participantId: 'participant-1', questionId: 'q-1', questionIndex: 0, answer: 'A', acceptedAt: '2026-09-23T00:00:00.000Z' });
});
