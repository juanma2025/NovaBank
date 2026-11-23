import type { SessionResponse } from '@nova/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import LoginPage from '../src/features/auth/pages/LoginPage.tsx';
import { AuthService } from '../src/features/auth/services/auth-service.ts';
import { SessionBroadcaster } from '../src/features/auth/services/session-broadcaster.ts';
import { HttpClient } from '../src/lib/http-client.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_SESSION: SessionResponse = {
  user: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'ana.perez@nova-test.edu.co',
    fullName: 'Ana María Pérez',
  },
  session: {
    idleTimeoutSeconds: 900,
    idleWarningSeconds: 60,
    lastActivityAt: '2026-11-22T15:30:00.000Z',
    absoluteExpiresAt: '2026-11-23T03:30:00.000Z',
  },
};

describe('Servicios POO e inyección en AppProviders', () => {
  it('HttpClient y AuthService encapsulan fetch, baseUrl y lastServerContactAt por instancia', async () => {
    const customFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(SAMPLE_SESSION, 200));

    const client = new HttpClient({ baseUrl: '/custom-api', fetchImpl: customFetch });
    const service = new AuthService(client);

    expect(client.lastServerContactAt).toBeNull();
    const session = await service.getSession();

    expect(session.user.email).toBe('ana.perez@nova-test.edu.co');
    expect(client.lastServerContactAt).toEqual(expect.any(Number));
    expect(customFetch).toHaveBeenCalledWith(
      '/custom-api/auth/session',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('SessionBroadcaster publica, recibe mensajes y deja de entregar tras dispose()', () => {
    const channels = new Map<string, Set<FakeChannel>>();
    class FakeChannel {
      onmessage: ((event: MessageEvent) => void) | null = null;
      closed = false;
      readonly name: string;
      constructor(name: string) {
        this.name = name;
        const set = channels.get(name) ?? new Set();
        set.add(this);
        channels.set(name, set);
      }
      postMessage(data: unknown): void {
        for (const peer of channels.get(this.name) ?? []) {
          if (peer !== this && !peer.closed) {
            peer.onmessage?.({ data } as MessageEvent);
          }
        }
      }
      close(): void {
        this.closed = true;
        channels.get(this.name)?.delete(this);
      }
    }

    const original = globalThis.BroadcastChannel;
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      writable: true,
      value: FakeChannel,
    });

    try {
      const a = new SessionBroadcaster('test-channel');
      const b = new SessionBroadcaster('test-channel');
      const received: unknown[] = [];

      b.subscribe((msg) => received.push(msg));
      a.publish({ type: 'logout', reason: 'expired' });
      expect(received).toEqual([{ type: 'logout', reason: 'expired' }]);

      b.dispose();
      a.publish({ type: 'logout', reason: 'idle' });
      expect(received).toHaveLength(1);
      a.dispose();
    } finally {
      Object.defineProperty(globalThis, 'BroadcastChannel', {
        configurable: true,
        writable: true,
        value: original,
      });
    }
  });

  it('AppProviders permite inyectar HttpClient y AuthService personalizados en pruebas', async () => {
    const user = userEvent.setup();
    const globalFetchSpy = vi.spyOn(globalThis, 'fetch');
    const customFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(SAMPLE_SESSION, 200));

    const httpClient = new HttpClient({ fetchImpl: customFetch });
    const authService = new AuthService(httpClient);
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, null);

    render(
      <AppProviders queryClient={queryClient} services={{ httpClient, authService }}>
        <MemoryRouter initialEntries={['/ingresar']}>
          <Routes>
            <Route path="/ingresar" element={<LoginPage />} />
            <Route path="/inicio" element={<p>Bienvenida DI</p>} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await user.type(screen.getByLabelText(/correo institucional/i), 'ana.perez@nova-test.edu.co');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'ClaveSegura#2026');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText('Bienvenida DI')).toBeTruthy();
    });
    expect(customFetch).toHaveBeenCalledTimes(1);
    expect(globalFetchSpy).not.toHaveBeenCalled();
  });
});
