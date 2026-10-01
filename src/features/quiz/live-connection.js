export function connectLiveSocket(url, { hostTicket, participant, onState, onResult, onStatus, onError } = {}, {
  WebSocketImpl = WebSocket, timers = globalThis, now = Date.now,
} = {}) {
  const socket = new WebSocketImpl(url);
  let disposed = false;
  let lastMessage = now();
  let authenticated = false;
  const authTimeout = timers.setTimeout(() => {
    if (!authenticated && !disposed) socket.close(4000, 'authentication timeout');
  }, 10_000);
  const heartbeat = timers.setInterval(() => {
    if (disposed || socket.readyState !== 1) return;
    if (now() - lastMessage > 45_000) socket.close(4000, 'heartbeat timeout');
    else socket.send('ping');
  }, 15_000);
  const cleanup = () => { timers.clearTimeout(authTimeout); timers.clearInterval(heartbeat); };
  socket.addEventListener('open', () => {
    if (disposed) return;
    if (hostTicket) socket.send(JSON.stringify({ type: 'auth-host', ticket: hostTicket }));
    else if (participant?.participantId && participant?.participantToken) socket.send(JSON.stringify({ type: 'auth-participant', ...participant }));
  });
  socket.addEventListener('message', (event) => {
    if (disposed) return;
    lastMessage = now();
    if (event.data === 'pong') return;
    let payload;
    try { payload = JSON.parse(event.data); } catch { return; }
    if (payload.type === 'state' && payload.state) {
      const verified = hostTicket ? Array.isArray(payload.state.participants)
        : participant ? Object.hasOwn(payload.state, 'receipt') : true;
      if (verified) {
        authenticated = true;
        timers.clearTimeout(authTimeout);
        onStatus?.('connected');
        onState?.(payload.state);
      }
    }
    if (payload.type === 'result' && payload.result && authenticated) onResult?.(payload.result);
    if (payload.type === 'error') {
      onError?.(payload.error);
      socket.close(4001, 'authentication failed');
    }
  });
  socket.addEventListener('close', () => { cleanup(); if (!disposed) onStatus?.('disconnected'); });
  socket.addEventListener('error', () => { if (!disposed) onStatus?.('error'); });
  return () => {
    disposed = true;
    cleanup();
    if (socket.readyState === 0 || socket.readyState === 1) socket.close(1000, 'page closed');
  };
}

export function latestLiveState(previous, next) {
  return previous?.id === next?.id && Number(previous.stateVersion) > Number(next.stateVersion) ? previous : next;
}
