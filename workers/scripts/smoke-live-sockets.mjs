import assert from 'node:assert/strict';

const connections = new Set();
export function closeSmokeSockets() {
  for (const socket of connections) socket.close();
  connections.clear();
}

function monitor(url, credentials) {
  const socket = new WebSocket(url);
  connections.add(socket);
  const observed = { socket, state: null, result: null, error: null };
  socket.addEventListener('open', () => socket.send(JSON.stringify(credentials)));
  socket.addEventListener('error', () => { observed.error = new Error('Production WebSocket transport failed'); });
  socket.addEventListener('message', (event) => {
    if (event.data === 'pong') return;
    const payload = JSON.parse(event.data);
    if (payload.type === 'error') observed.error = new Error(`WebSocket auth: ${payload.error?.code}`);
    const authorized = credentials.type === 'auth-host' ? Array.isArray(payload.state?.participants) : Object.hasOwn(payload.state || {}, 'receipt');
    if (payload.type === 'state' && authorized) observed.state = payload.state;
    if (payload.type === 'result') observed.result = payload.result;
  });
  return observed;
}

async function waitFor(observed, predicate, label) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (observed.error) throw observed.error;
    if (predicate(observed)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`WebSocket timed out: ${label}`);
}

export async function testLiveSockets({ workerUrl, call, classroom, live, teacherToken, participants }) {
  const socketUrl = `${workerUrl.replace(/^http/, 'ws')}/live-quizzes/${live.code}/socket`;
  const ticketRoute = `/classes/${classroom.id}/live-sessions/${live.id}/socket-ticket`;
  const ticket = (await call('host socket ticket', 'POST', ticketRoute, teacherToken, {})).socket;
  let host = monitor(socketUrl, { type: 'auth-host', ticket: ticket.ticket });
  const players = participants.map((participant) => monitor(socketUrl, { type: 'auth-participant', ...participant }));
  await Promise.all([host, ...players].map((client) => waitFor(client, (c) => c.state?.phase === 'lobby', 'lobby authentication')));
  assert.equal(host.state.participantCount, 4);
  console.log('Production WebSocket: 1 host + 4 players authenticated');
  return {
    async expectPhase(phase) {
      await Promise.all([host, ...players].map((client) => waitFor(client, (c) => c.state?.phase === phase, phase)));
      if (phase === 'question') assert.equal(players[0].state.question.correctAnswer, undefined);
      if (phase === 'finished') {
        await waitFor(players[0], (c) => Boolean(c.result), 'personal final result');
        assert.equal(players[0].result.participant.score, 1);
      }
      console.log(`Production WebSocket phase ${phase}: PASS`);
    },
    async reconnect() {
      host.socket.close(); players[0].socket.close();
      const nextTicket = (await call('host reconnect ticket', 'POST', ticketRoute, teacherToken, {})).socket;
      host = monitor(socketUrl, { type: 'auth-host', ticket: nextTicket.ticket });
      players[0] = monitor(socketUrl, { type: 'auth-participant', ...participants[0] });
      await waitFor(players[0], (c) => c.state?.receipt?.accepted, 'recovered answer lock');
      await waitFor(host, (c) => c.state?.participantCount === 4, 'host recovery');
      console.log('Production WebSocket disconnect/reconnect + answer lock: PASS');
    },
    close: closeSmokeSockets,
  };
}
