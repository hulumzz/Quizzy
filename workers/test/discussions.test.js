import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDiscussionId, validateDiscussionInput, validateDiscussionStatus } from '../src/validation/discussions.js';

test('discussion input trims bounded message content', () => {
  assert.deepEqual(validateDiscussionInput({ content: '  Bagaimana prosesnya?  ' }), { content: 'Bagaimana prosesnya?' });
  assert.throws(() => validateDiscussionInput({ content: ' ' }), (error) => error.code === 'VALIDATION_ERROR' && Boolean(error.details.content));
  assert.throws(() => validateDiscussionInput({ content: 'x'.repeat(3001) }), (error) => error.code === 'VALIDATION_ERROR');
});

test('discussion status permits a selected answer only on resolved discussions', () => {
  assert.deepEqual(validateDiscussionStatus({ status: 'resolved', answerId: 'reply-1' }), { status: 'resolved', answerId: 'reply-1' });
  assert.deepEqual(validateDiscussionStatus({ status: 'open', answerId: null }), { status: 'open', answerId: null });
  assert.throws(() => validateDiscussionStatus({ status: 'open', answerId: 'reply-1' }), (error) => error.code === 'VALIDATION_ERROR');
  assert.throws(() => validateDiscussionId('../reply'), (error) => error.code === 'INVALID_DISCUSSION_ID');
});
