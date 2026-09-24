import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveQuizAnswerProcessor } from '../src/functions/live-quiz-answers/index.js';
import { conflict } from '../src/http/errors.js';

test('processor retries only transient answer records and discards stale answers', async () => {
  const seen = [];
  const info = [];
  const process = createLiveQuizAnswerProcessor({ answerRepository: { async processQueuedAnswer(body) { seen.push(body.sessionId); if (body.sessionId === 'stale') throw conflict('LIVE_QUESTION_CHANGED', 'stale'); if (body.sessionId === 'retry') throw new Error('temporary'); } }, logger: { error() {}, warn() {}, info(message) { info.push(JSON.parse(message)); } } });
  const result = await process({ Records: [
    { messageId: 'one', body: JSON.stringify({ sessionId: 'ok' }) },
    { messageId: 'two', body: JSON.stringify({ sessionId: 'stale' }) },
    { messageId: 'three', body: JSON.stringify({ sessionId: 'retry' }) },
  ] });
  assert.deepEqual(seen, ['ok', 'stale', 'retry']);
  assert.deepEqual(result, { batchItemFailures: [{ itemIdentifier: 'three' }] });
  assert.deepEqual(info, [{ function: 'live-quiz-answer-processor', outcome: 'batch-summary', records: 3, processed: 1, discarded: 1, retry: 1 }]);
});
