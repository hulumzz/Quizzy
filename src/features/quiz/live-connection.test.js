import test from 'node:test';
import assert from 'node:assert/strict';
import { connectLiveSocket, latestLiveState } from './live-connection.js';

test('socket authenticates before showing connected, detects silent disconnect, and disposes timers', () => {
  const callbacks = new Map(); const pending = new Map(); let clock = 0; let id = 0;
  class FakeSocket {
    readyState = 1; sent = [];
    constructor() {}
    addEventListener(name, callback) { callbacks.set(name, callback); }
    send(value) { this.sent.push(value); }
    close() { this.readyState = 3; callbacks.get('close')?.(); }
  }
  const timers = { setTimeout(fn) { pending.set(++id, fn); return id; }, setInterval(fn) { pending.set(++id, fn); return id; }, clearTimeout(i) { pending.delete(i); }, clearInterval(i) { pending.delete(i); } };
  const statuses = []; const states = [];
  const close = connectLiveSocket('wss://example.test', { participant: { participantId: 'p1', participantToken: 'token' }, onState: (s) => states.push(s), onStatus: (s) => statuses.push(s) }, { WebSocketImpl: FakeSocket, timers, now: () => clock });
  callbacks.get('open')(); assert.equal(statuses.length, 0);
  callbacks.get('message')({ data: JSON.stringify({ type: 'state', state: { id: 'room' } }) });
  assert.equal(states.length, 0);
  callbacks.get('message')({ data: JSON.stringify({ type: 'state', state: { id: 'room', receipt: null } }) });
  assert.deepEqual(statuses, ['connected']);
  clock = 50_000; [...pending.values()][0]();
  assert.equal(statuses.at(-1), 'disconnected');
  close(); assert.equal(pending.size, 0);
});

test('late REST bootstrap never regresses a newer socket question', () => {
  const current = { id: 'ABC234', stateVersion: 5, phase: 'reveal' };
  assert.equal(latestLiveState(current, { id: 'ABC234', stateVersion: 2, phase: 'question' }), current);
  assert.equal(latestLiveState(current, { id: 'ABC234', stateVersion: 6 }).stateVersion, 6);
});
