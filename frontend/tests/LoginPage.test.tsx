import type { SessionResponse } from '@nova/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { PublicOnly } from '../src/app/PublicOnly.tsx';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import LoginPage from '../src/features/auth/pages/LoginPage.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const LOGGED_IN_SESSION: SessionResponse = {
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

function DestinationProbe() {
  const location = useLocation();
  return <p data-testid="dest">{`${location.pathname}${location.search}`}</p>;
}

function renderLogin(initialUrl = '/ingresar') {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, null);

  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/ingresar" element={<LoginPage />} />
          </Route>
          <Route path="/inicio" element={<DestinationProbe />} />
          <Route path="/privacidad" element={<DestinationProbe />} />
          <Route path="/registro" element={<p>Registro</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('LoginPage (US2)', () => {
  it('muestra error genérico ante INVALID_CREDENTIALS', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Correo o contraseña incorrectos.',
            requestId: REQUEST_ID,
          },
        },
        401,
      ),
    );

    renderLogin();

    await user.type(screen.getByLabelText(/correo institucional/i), 'ana.perez@nova-test.edu.co');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'ClaveEquivocada123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText(/correo o contraseña incorrectos/i)).toBeTruthy();
  });

  it('muestra los minutos restantes ante LOGIN_LOCKED', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'LOGIN_LOCKED',
            message: 'Bloqueado',
            requestId: REQUEST_ID,
            details: { retryAfterSeconds: 780 },
          },
        },
        429,
      ),
    );

    renderLogin();

    await user.type(screen.getByLabelText(/correo institucional/i), 'ana.perez@nova-test.edu.co');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'ClaveSegura#2026');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByText(/13 minutos/i)).toBeTruthy();
  });

  it('redirige a la ruta interna de ?redirect= tras iniciar sesión y bloquea URLs externas', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(LOGGED_IN_SESSION, 200));

    renderLogin('/ingresar?redirect=%2Fprivacidad%3Fver%3D1');

    await user.type(screen.getByLabelText(/correo institucional/i), 'ana.perez@nova-test.edu.co');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'ClaveSegura#2026');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByTestId('dest').textContent).toBe('/privacidad?ver=1');
    });
  });

  it('ignora un ?redirect= externo y navega a /inicio', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(LOGGED_IN_SESSION, 200));

    renderLogin('/ingresar?redirect=https%3A%2F%2Fevil.example%2Fphish');

    await user.type(screen.getByLabelText(/correo institucional/i), 'ana.perez@nova-test.edu.co');
    await user.type(screen.getByLabelText(/^contraseña$/i), 'ClaveSegura#2026');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByTestId('dest').textContent).toBe('/inicio');
    });
  });

  it('muestra los avisos correspondientes según ?motivo=', () => {
    const { unmount } = renderLogin('/ingresar?motivo=inactividad');
    expect(screen.getByText(/sesión cerrada por inactividad/i)).toBeTruthy();
    unmount();

    const { unmount: unmount2 } = renderLogin('/ingresar?motivo=expirada');
    expect(screen.getByText(/tu sesión terminó/i)).toBeTruthy();
    unmount2();

    renderLogin('/ingresar?motivo=clave-cambiada');
    expect(screen.getByText(/contraseña actualizada/i)).toBeTruthy();
  });
});
