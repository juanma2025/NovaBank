export const SESSION_CHANNEL_NAME = 'nova-session';

export type SessionBroadcastMessage =
  | { type: 'activity'; serverContactAt?: number }
  | { type: 'keepalive'; serverContactAt?: number }
  | { type: 'logout'; reason: 'logout' | 'idle' };

export function broadcastSessionMessage(message: SessionBroadcastMessage): void {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  } catch {
    // Entornos sin BroadcastChannel funcional omiten la sincronización entre pestañas.
  }
}

export function subscribeSessionChannel(
  onMessage: (message: SessionBroadcastMessage) => void,
): { post: (message: SessionBroadcastMessage) => void; close: () => void } | null {
  if (typeof BroadcastChannel === 'undefined') return null;

  const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const msg = event.data as SessionBroadcastMessage | null;
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
    onMessage(msg);
  };

  return {
    post: (message) => channel.postMessage(message),
    close: () => channel.close(),
  };
}
