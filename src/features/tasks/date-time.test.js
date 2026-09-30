import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultLocalDateTime, toLocalDateTimeInput } from './date-time.js';

test('datetime-local values are formatted with local date fields, not a UTC slice', () => {
  const date = new Date(2026, 8, 29, 9, 5, 0);
  assert.equal(toLocalDateTimeInput(date), '2026-09-29T09:05');
  assert.match(defaultLocalDateTime(0, date.getTime()), /^2026-09-29T09:00$/);
});
