export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'nova:theme';

export type ThemeListener = (theme: ThemeMode) => void;

export interface ThemeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ThemeControllerOptions {
  storage?: ThemeStorageLike;
  matchMedia?: (query: string) => MediaQueryList;
  targetElement?: HTMLElement | null;
  key?: string;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

/**
 * Controlador POO de tema claro/oscuro.
 * Lee `prefers-color-scheme` por defecto, persiste la preferencia explícita en
 * `localStorage['nova:theme']` dentro de `try/catch` (sin datos sensibles), aplica
 * `data-theme` en `document.documentElement` y gestiona suscripciones con `dispose()`.
 */
export class ThemeController {
  private readonly key: string;
  private readonly customStorage?: ThemeStorageLike;
  private readonly customMatchMedia?: (query: string) => MediaQueryList;
  private readonly customTarget?: HTMLElement | null;
  private readonly listeners = new Set<ThemeListener>();
  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((event: MediaQueryListEvent) => void) | null = null;
  private hasExplicitPreference = false;
  private currentTheme: ThemeMode;
  private disposed = false;

  constructor(options: ThemeControllerOptions = {}) {
    this.key = options.key ?? THEME_STORAGE_KEY;
    if (options.storage) this.customStorage = options.storage;
    if (options.matchMedia) this.customMatchMedia = options.matchMedia;
    if ('targetElement' in options) this.customTarget = options.targetElement;

    const stored = this.readStoredTheme();
    if (stored) {
      this.hasExplicitPreference = true;
      this.currentTheme = stored;
    } else {
      this.currentTheme = this.readSystemTheme();
    }

    this.attachSystemListener();
  }

  getTheme(): ThemeMode {
    return this.currentTheme;
  }

  apply(): ThemeMode {
    const target = this.resolveTargetElement();
    if (target) {
      target.setAttribute('data-theme', this.currentTheme);
    }
    return this.currentTheme;
  }

  setTheme(mode: ThemeMode): void {
    if (this.disposed) return;
    this.hasExplicitPreference = true;
    this.currentTheme = mode;
    this.writeStoredTheme(mode);
    this.apply();
    this.notify();
  }

  toggle(): ThemeMode {
    const next: ThemeMode = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }

  subscribe(listener: ThemeListener): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
    if (this.mediaQuery && this.mediaListener) {
      this.mediaQuery.removeEventListener?.('change', this.mediaListener);
    }
    this.mediaQuery = null;
    this.mediaListener = null;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.currentTheme);
    }
  }

  private resolveStorage(): ThemeStorageLike | null {
    if (this.customStorage) return this.customStorage;
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private resolveTargetElement(): HTMLElement | null {
    if (this.customTarget !== undefined) return this.customTarget;
    if (typeof document === 'undefined') return null;
    return document.documentElement;
  }

  private resolveMatchMedia(): ((query: string) => MediaQueryList) | null {
    if (this.customMatchMedia) return this.customMatchMedia;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia.bind(window);
  }

  private readStoredTheme(): ThemeMode | null {
    const storage = this.resolveStorage();
    if (!storage) return null;
    try {
      const value = storage.getItem(this.key);
      return isThemeMode(value) ? value : null;
    } catch {
      return null;
    }
  }

  private writeStoredTheme(mode: ThemeMode): void {
    const storage = this.resolveStorage();
    if (!storage) return;
    try {
      storage.setItem(this.key, mode);
    } catch {
      // Mantiene el tema en memoria si localStorage no está disponible.
    }
  }

  private readSystemTheme(): ThemeMode {
    const matcher = this.resolveMatchMedia();
    if (!matcher) return 'light';
    try {
      return matcher('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  private attachSystemListener(): void {
    const matcher = this.resolveMatchMedia();
    if (!matcher) return;
    try {
      const mq = matcher('(prefers-color-scheme: dark)');
      const handler = (event: MediaQueryListEvent) => {
        if (this.disposed || this.hasExplicitPreference) return;
        this.currentTheme = event.matches ? 'dark' : 'light';
        this.apply();
        this.notify();
      };
      mq.addEventListener?.('change', handler);
      this.mediaQuery = mq;
      this.mediaListener = handler;
    } catch {
      // Entornos sin matchMedia reactivo mantienen el tema resuelto.
    }
  }
}

export const themeController = new ThemeController();
