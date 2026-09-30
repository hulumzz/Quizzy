import assert from 'node:assert/strict';
import test from 'node:test';
import { initialiseArrangeAnswers, resolveLiveSessionId, shuffledItemIds } from './runtime.js';

test('live session resolver accepts the canonical id and the temporary legacy field', () => {
  assert.equal(resolveLiveSessionId({ id: 'canonical', sessionId: 'legacy' }), 'canonical');
  assert.equal(resolveLiveSessionId({ sessionId: 'legacy' }), 'legacy');
  assert.equal(resolveLiveSessionId({}), null);
});

test('arrange answers are Fisher-Yates shuffled once and retained for immediate submission', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(shuffledItemIds(items, () => 0), ['b', 'c', 'a']);
  const questions = [{ id: 'arrange-1', type: 'arrange', items }];
  const initial = initialiseArrangeAnswers(questions, {}, () => 0);
  assert.deepEqual(initial, { 'arrange-1': ['b', 'c', 'a'] });
  assert.equal(initialiseArrangeAnswers(questions, initial, () => 0.9), initial);
});
