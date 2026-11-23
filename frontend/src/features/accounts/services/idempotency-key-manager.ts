export type UuidGenerator = () => string;

function defaultUuidGenerator(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const random = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `nova-${random}`;
}

/**
 * Genera una `Idempotency-Key` una sola vez por intento confirmado y la reutiliza
 * en reintentos del mismo intento (Principio I, regla 4; spec 002 research R5).
 */
export class IdempotencyKeyManager {
  private readonly generateUuid: UuidGenerator;
  private activeFingerprint: string | null = null;
  private activeKey: string | null = null;

  constructor(generateUuid: UuidGenerator = defaultUuidGenerator) {
    this.generateUuid = generateUuid;
  }

  get currentKey(): string | null {
    return this.activeKey;
  }

  getOrCreateForAttempt(fingerprint: string): string {
    if (this.activeKey !== null && this.activeFingerprint === fingerprint) {
      return this.activeKey;
    }
    const nextKey = this.generateUuid();
    this.activeFingerprint = fingerprint;
    this.activeKey = nextKey;
    return nextKey;
  }

  reset(): void {
    this.activeFingerprint = null;
    this.activeKey = null;
  }
}
