import { describe, expect, it, vi } from 'vitest';

import {
  THEME_STORAGE_KEY,
  ThemeController,
  type ThemeStorageLike,
} from '../src/lib/theme-controller.ts';

function createMockMatchMedia(initialDark: boolean) {
  let matches = initialDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const mediaQuery = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change' && typeof listener === 'function') {
        listeners.add(listener as (event: MediaQueryListEvent) => void);
      }
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'change' && typeof listener === 'function') {
        listeners.delete(listener as (event: MediaQueryListEvent) => void);
      }
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  } as unknown as MediaQueryList;

  return {
    matchMedia: () => mediaQuery,
    emitChange(nextDark: boolean) {
      matches = nextDark;
      for (const listener of listeners) {
        listener({ matches: nextDark } as MediaQueryListEvent);
      }
    },
  };
}

describe('ThemeController', () => {
  it('lee prefers-color-scheme por defecto, aplica data-theme y sigue cambios del sistema hasta dispose()', () => {
    const target = document.createElement('html');
    const storageMap = new Map<string, string>();
    const storage: ThemeStorageLike = {
      getItem: (k) => storageMap.get(k) ?? null,
      setItem: (k, v) => {
        storageMap.set(k, v);
      },
    };
    const mockMedia = createMockMatchMedia(true);

    const controller = new ThemeController({
      storage,
      matchMedia: mockMedia.matchMedia,
      targetElement: target,
    });

    expect(controller.getTheme()).toBe('dark');
    controller.apply();
    expect(target.getAttribute('data-theme')).toBe('dark');

    const listener = vi.fn();
    controller.subscribe(listener);

    mockMedia.emitChange(false);
    expect(controller.getTheme()).toBe('light');
    expect(target.getAttribute('data-theme')).toBe('light');
    expect(listener).toHaveBeenCalledWith('light');

    controller.dispose();
    mockMedia.emitChange(true);
    expect(controller.getTheme()).toBe('light');
  });

  it('persiste la preferencia explícita en localStorage y sobrevive a una nueva instancia', () => {
    const target = document.createElement('html');
    const storageMap = new Map<string, string>();
    const storage: ThemeStorageLike = {
      getItem: (k) => storageMap.get(k) ?? null,
      setItem: (k, v) => {
        storageMap.set(k, v);
      },
    };
    const mockMedia = createMockMatchMedia(false);

    const first = new ThemeController({
      storage,
      matchMedia: mockMedia.matchMedia,
      targetElement: target,
    });

    expect(first.getTheme()).toBe('light');
    expect(first.toggle()).toBe('dark');
    expect(storageMap.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(target.getAttribute('data-theme')).toBe('dark');

    // Una preferencia explícita ignora cambios posteriores del sistema.
    mockMedia.emitChange(false);
    expect(first.getTheme()).toBe('dark');
    first.dispose();

    const second = new ThemeController({
      storage,
      matchMedia: mockMedia.matchMedia,
      targetElement: target,
    });
    expect(second.getTheme()).toBe('dark');
    second.dispose();
  });

  it('funciona en memoria sin lanzar excepciones cuando localStorage falla', () => {
    const target = document.createElement('html');
    const brokenStorage: ThemeStorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const mockMedia = createMockMatchMedia(false);

    const controller = new ThemeController({
      storage: brokenStorage,
      matchMedia: mockMedia.matchMedia,
      targetElement: target,
    });

    expect(controller.getTheme()).toBe('light');
    expect(controller.toggle()).toBe('dark');
    expect(target.getAttribute('data-theme')).toBe('dark');
    expect(controller.toggle()).toBe('light');
    expect(target.getAttribute('data-theme')).toBe('light');
    controller.dispose();
  });
});
