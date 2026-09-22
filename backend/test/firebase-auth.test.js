import assert from 'node:assert/strict';
import test from 'node:test';
import { readBearerToken } from '../src/middleware/firebase-auth.js';

test('readBearerToken accepts case-insensitive Bearer headers', () => {
  assert.equal(readBearerToken({ headers: { Authorization: 'Bearer token-value' } }), 'token-value');
});

test('readBearerToken rejects missing and malformed headers', () => {
  assert.throws(() => readBearerToken({ headers: {} }), { statusCode: 401, code: 'UNAUTHORIZED' });
  assert.throws(() => readBearerToken({ headers: { authorization: 'Basic value' } }), { statusCode: 401, code: 'UNAUTHORIZED' });
});
