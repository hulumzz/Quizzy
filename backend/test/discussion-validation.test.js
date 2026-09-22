import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDiscussionInput, validateDiscussionStatus } from '../src/validation/discussion.js';

test('discussion validation trims bounded message content', () => {
  assert.deepEqual(validateDiscussionInput({ content: '  Bagaimana prosesnya?  ' }), { content: 'Bagaimana prosesnya?' });
  assert.throws(() => validateDiscussionInput({ content: ' ' }), (error) => error.code === 'VALIDATION_ERROR' && Boolean(error.details.content));
});

test('discussion status accepts resolved answers and rejects answers on open threads', () => {
  assert.deepEqual(validateDiscussionStatus({ status: 'resolved', answerId: 'reply-1' }), { status: 'resolved', answerId: 'reply-1' });
  assert.throws(() => validateDiscussionStatus({ status: 'open', answerId: 'reply-1' }), (error) => error.code === 'VALIDATION_ERROR');
});
