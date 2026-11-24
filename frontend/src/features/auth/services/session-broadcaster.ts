export const SESSION_CHANNEL_NAME = 'nova-session';

export type SessionBroadcastMessage =
  | { type: 'activity'; serverContactAt?: number }
  | { type: 'keepalive'; serverContactAt?: number }
  | { type: 'logout'; reason: 'logout' | 'idle' | 'expired' };

export type SessionBroadcastListener = (message: SessionBroadcastMessage) => void;

/**
 * Encapsula `BroadcastChannel('nova-session')` para sincronizar actividad, renovación y cierre
 * de sesión entre pestañas con ciclo de vida explícito (`dispose()`).
 */
export class SessionBroadcaster {
  private readonly channelName: string;
  private channel: BroadcastChannel | null = null;
  private readonly listeners = new Set<SessionBroadcastListener>();
  private disposed = false;

  constructor(channelName = SESSION_CHANNEL_NAME) {
    this.channelName = channelName;
  }

  publish(message: SessionBroadcastMessage): void {
    if (this.disposed) return;
    const channel = this.ensureChannel();
    if (!channel) return;
    try {
      channel.postMessage(message);
    } catch {
      // Entornos sin BroadcastChannel funcional omiten la sincronización.
    }
  }

  subscribe(listener: SessionBroadcastListener): () => void {
    if (this.disposed) return () => {};
    this.ensureChannel();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
    if (this.channel) {
      this.channel.onmessage = null;
      this.channel.close();
      this.channel = null;
    }
  }

  private ensureChannel(): BroadcastChannel | null {
    if (this.channel) return this.channel;
    if (typeof BroadcastChannel === 'undefined') return null;

    try {
      const channel = new BroadcastChannel(this.channelName);
      channel.onmessage = (event: MessageEvent<unknown>) => {
        const msg = event.data as SessionBroadcastMessage | null;
        if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
        for (const listener of this.listeners) {
          listener(msg);
        }
      };
      this.channel = channel;
      return channel;
    } catch {
      return null;
    }
  }
}
