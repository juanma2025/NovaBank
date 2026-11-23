import type { SessionResponse } from '@nova/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { AppRoutes } from '../src/app/router.tsx';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import { THEME_STORAGE_KEY, ThemeController } from '../src/lib/theme-controller.ts';

const ACTIVE_SESSION: SessionResponse = {
  user: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'ana.perez@ucc.edu.co',
    fullName: 'Ana María Pérez',
  },
  session: {
    idleTimeoutSeconds: 900,
    idleWarningSeconds: 60,
    lastActivityAt: '2026-11-22T15:00:00.000Z',
    absoluteExpiresAt: '2026-11-23T03:00:00.000Z',
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('LandingPage y selector de tema (/)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renderiza la Landing Page en / sin sesión con landmarks, accesos, características, público objetivo y «Muy pronto»', async () => {
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    const controller = new ThemeController({ targetElement: document.documentElement });

    render(
      <AppProviders queryClient={queryClient} services={{ themeController: controller }}>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /la banca universitaria pensada para tu día a día/i,
      }),
    ).toBeTruthy();

    // Landmarks semánticos WCAG
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();

    // Accesos visibles a /ingresar y /registro
    const loginLinks = screen.getAllByRole('link', { name: /iniciar sesión/i });
    const registerLinks = screen.getAllByRole('link', { name: /crear cuenta/i });
    expect(loginLinks.length).toBeGreaterThanOrEqual(2);
    expect(registerLinks.length).toBeGreaterThanOrEqual(2);
    expect(loginLinks.every((el) => el.getAttribute('href') === '/ingresar')).toBe(true);
    expect(registerLinks.every((el) => el.getAttribute('href') === '/registro')).toBe(true);

    // Secciones de valor, Bento Grid, público objetivo y patrón «Muy pronto»
    expect(screen.getByRole('heading', { name: /qué hace nova/i })).toBeTruthy();
    expect(screen.getByText(/cuenta en cop exactos y libro contable/i)).toBeTruthy();
    expect(screen.getByText(/transferencias entre compañeros/i)).toBeTruthy();
    expect(screen.getByText(/tarjeta virtual simulada/i)).toBeTruthy();
    expect(screen.getByText(/metas de ahorro y presupuestos/i)).toBeTruthy();
    expect(screen.getByText(/gastos compartidos/i)).toBeTruthy();
    expect(screen.getByText(/wallet cripto/i)).toBeTruthy();
    expect(screen.getByText(/muy pronto/i)).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: /diseñada para estudiantes universitarios en colombia/i,
      }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /leer política de datos/i }).getAttribute('href')).toBe(
      '/privacidad',
    );

    controller.dispose();
  });

  it('permite alternar entre modo claro y oscuro con ThemeToggle actualizando data-theme y ARIA', async () => {
    const user = userEvent.setup();
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
    const controller = new ThemeController({ targetElement: document.documentElement });

    render(
      <AppProviders queryClient={queryClient} services={{ themeController: controller }}>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );

    const toDark = await screen.findByRole('button', { name: /cambiar a modo oscuro/i });
    expect(toDark.getAttribute('aria-pressed')).toBe('false');

    await user.click(toDark);

    const toLight = screen.getByRole('button', { name: /cambiar a modo claro/i });
    expect(toLight.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await user.click(toLight);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    controller.dispose();
  });

  it('redirige automáticamente de / a /inicio cuando ya existe sesión activa', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        id: '33333333-3333-4333-8333-333333333333',
        currency: 'COP',
        balance: 0,
        recentMovements: [],
      }),
    );

    const queryClient = createAppQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, ACTIVE_SESSION);

    render(
      <AppProviders queryClient={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeTruthy();
    });
  });
});
