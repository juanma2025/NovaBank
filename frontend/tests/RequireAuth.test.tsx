import type { SessionResponse } from '@nova/shared';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { PublicOnly } from '../src/app/PublicOnly.tsx';
import { RequireAuth } from '../src/app/RequireAuth.tsx';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';

const SAMPLE_SESSION: SessionResponse = {
  user: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'ana.perez@nova-test.edu.co',
    fullName: 'Ana Pérez',
  },
  session: {
    idleTimeoutSeconds: 900,
    idleWarningSeconds: 60,
    lastActivityAt: '2026-11-22T14:00:00.000Z',
    absoluteExpiresAt: '2026-11-23T02:00:00.000Z',
  },
};

function LoginProbe() {
  const location = useLocation();
  return <p data-testid="login-location">{`${location.pathname}${location.search}`}</p>;
}

describe('RequireAuth y PublicOnly', () => {
  it('redirige a /ingresar preservando la ruta original en ?redirect= cuando no hay sesión', async () => {
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, null);

    render(
      <AppProviders queryClient={queryClient}>
        <MemoryRouter initialEntries={['/inicio?seccion=resumen']}>
          <Routes>
            <Route path="/ingresar" element={<LoginProbe />} />
            <Route element={<RequireAuth />}>
              <Route path="/inicio" element={<p>Contenido privado</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-location').textContent).toBe(
        '/ingresar?redirect=%2Finicio%3Fseccion%3Dresumen',
      );
    });
  });

  it('renderiza la ruta protegida cuando existe una sesión válida', async () => {
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, SAMPLE_SESSION);

    render(
      <AppProviders queryClient={queryClient}>
        <MemoryRouter initialEntries={['/inicio']}>
          <Routes>
            <Route path="/ingresar" element={<LoginProbe />} />
            <Route element={<RequireAuth />}>
              <Route path="/inicio" element={<p>Contenido privado</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText('Contenido privado')).toBeTruthy();
  });

  it('PublicOnly redirige a /inicio cuando ya hay sesión', async () => {
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, SAMPLE_SESSION);

    render(
      <AppProviders queryClient={queryClient}>
        <MemoryRouter initialEntries={['/ingresar']}>
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/ingresar" element={<p>Formulario login</p>} />
            </Route>
            <Route path="/inicio" element={<p>Pantalla inicio</p>} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText('Pantalla inicio')).toBeTruthy();
  });
});
