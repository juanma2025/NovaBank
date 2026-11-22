import type { SessionResponse } from '@nova/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient, SessionProvider } from '../src/app/providers.tsx';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import { resetLastServerContactAt } from '../src/lib/api-client.ts';

class MockBroadcastChannel {
  static channels = new Map<string, Set<MockBroadcastChannel>>();
  readonly name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private readonly listeners = new Set<(event: MessageEvent) => void>();

  constructor(name: string) {
    this.name = name;
    const group = MockBroadcastChannel.channels.get(name) ?? new Set();
    group.add(this);
    MockBroadcastChannel.channels.set(name, group);
  }

  postMessage(data: unknown): void {
    const group = MockBroadcastChannel.channels.get(this.name);
    if (!group) return;
    for (const peer of group) {
      if (peer === this) continue;
      const event = { data } as MessageEvent;
      peer.onmessage?.(event);
      for (const listener of peer.listeners) {
        listener(event);
      }
    }
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === 'message') this.listeners.delete(listener);
  }

  close(): void {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }

  static reset(): void {
    MockBroadcastChannel.channels.clear();
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeSession(
  nowMs: number,
  idleTimeoutSeconds = 900,
  idleWarningSeconds = 60,
): SessionResponse {
  return {
    user: {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'ana.perez@nova-test.edu.co',
      fullName: 'Ana María Pérez',
    },
    session: {
      idleTimeoutSeconds,
      idleWarningSeconds,
      lastActivityAt: new Date(nowMs).toISOString(),
      absoluteExpiresAt: new Date(nowMs + 12 * 60 * 60 * 1000).toISOString(),
    },
  };
}

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderWithSession(session: SessionResponse) {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, session);

  return {
    queryClient,
    ...render(
      <AppProviders queryClient={queryClient}>
        <MemoryRouter initialEntries={['/inicio']}>
          <SessionProvider>
            <Routes>
              <Route path="/inicio" element={<LocationProbe />} />
              <Route path="/ingresar" element={<LocationProbe />} />
            </Routes>
          </SessionProvider>
        </MemoryRouter>
      </AppProviders>,
    ),
  };
}

describe('useIdleTimer e InactivityDialog (US2)', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T15:00:00.000Z'));
    resetLastServerContactAt();
    MockBroadcastChannel.reset();
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      writable: true,
      value: MockBroadcastChannel,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    MockBroadcastChannel.reset();
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      writable: true,
      value: originalBroadcastChannel,
    });
  });

  it('muestra el aviso en idleTimeoutSeconds - idleWarningSeconds desde el último contacto con el servidor (no desde la interacción local)', async () => {
    const now = Date.now();
    renderWithSession(makeSession(now, 900, 60));

    // Interacción local dentro del umbral de 60 s: no llama a refresh ni retrasa el aviso.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
      fireEvent.pointerDown(window);
    });

    expect(screen.queryByRole('dialog')).toBeNull();

    // Faltando 1 s para los 840 s desde el contacto inicial (t = 839 s): aún no aparece.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(819_000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    // En t = 840 s exactos (900 - 60): aparece el diálogo con 60 s restantes.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/60 segundos/i)).toBeTruthy();
  });

  it('al pulsar «Seguir conectado» llama a POST /auth/refresh y cierra el aviso', async () => {
    const start = Date.now();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(makeSession(Date.now(), 900, 60), 200));

    renderWithSession(makeSession(start, 900, 60));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(840_000);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /seguir conectado/i }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('al terminar la cuenta regresiva llama a POST /auth/logout y redirige con motivo=inactividad', async () => {
    const start = Date.now();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    renderWithSession(makeSession(start, 20, 8));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
    expect(screen.getByTestId('location').textContent).toBe(
      '/ingresar?motivo=inactividad&redirect=%2Finicio',
    );
  });

  it('sincroniza activity, keepalive y logout entre pestañas mediante BroadcastChannel', async () => {
    const start = Date.now();
    const peer = new MockBroadcastChannel('nova-session');
    renderWithSession(makeSession(start, 900, 60));

    // Otra pestaña reporta actividad con contacto de servidor en t = 400 s: reinicia el contador.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400_000);
      peer.postMessage({ type: 'activity', serverContactAt: Date.now() });
    });

    // En t = 840 s ya no debe aparecer el aviso porque se reinició desde t = 400 s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(440_000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    // En t = 1240 s (400 + 840) sí aparece el aviso.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400_000);
    });
    expect(screen.getByRole('dialog')).toBeTruthy();

    // Otra pestaña pulsa «Seguir conectado» (keepalive): el aviso se cierra aquí también.
    await act(async () => {
      peer.postMessage({ type: 'keepalive', serverContactAt: Date.now() });
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    // Otra pestaña cierra sesión (logout): esta pestaña también limpia y navega a /ingresar.
    await act(async () => {
      peer.postMessage({ type: 'logout', reason: 'logout' });
    });
    expect(screen.getByTestId('location').textContent).toBe('/ingresar');

    peer.close();
  });
});
