export const BALANCE_VISIBILITY_STORAGE_KEY = 'nova:hide-balance';

export type VisibilityListener = (hidden: boolean) => void;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Encapsula la preferencia local de ocultar saldo y montos (`localStorage['nova:hide-balance']`)
 * con protección `try/catch` (spec 002 research R11). Nunca almacena secretos ni tokens.
 */
export class BalanceVisibilityStore {
  private readonly key: string;
  private readonly customStorage?: StorageLike;
  private readonly listeners = new Set<VisibilityListener>();
  private fallbackHidden = false;

  constructor(options: { storage?: StorageLike; key?: string } = {}) {
    this.key = options.key ?? BALANCE_VISIBILITY_STORAGE_KEY;
    if (options.storage) this.customStorage = options.storage;
  }

  isHidden(): boolean {
    const storage = this.resolveStorage();
    if (!storage) return this.fallbackHidden;
    try {
      const value = storage.getItem(this.key);
      if (value === null) return this.fallbackHidden;
      return value === 'true';
    } catch {
      return this.fallbackHidden;
    }
  }

  setHidden(hidden: boolean): void {
    this.fallbackHidden = hidden;
    const storage = this.resolveStorage();
    if (storage) {
      try {
        storage.setItem(this.key, hidden ? 'true' : 'false');
      } catch {
        // Si localStorage falla (ej. modo privado estricto), mantenemos el estado en memoria.
      }
    }
    for (const listener of this.listeners) {
      listener(hidden);
    }
  }

  toggle(): boolean {
    const next = !this.isHidden();
    this.setHidden(next);
    return next;
  }

  subscribe(listener: VisibilityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private resolveStorage(): StorageLike | null {
    if (this.customStorage) return this.customStorage;
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
}
