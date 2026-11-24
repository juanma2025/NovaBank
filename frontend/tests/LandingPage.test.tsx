import type { SessionResponse } from '@nova/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
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

function assertUniqueAuthButtonsInHeader() {
  const header = screen.getByRole('banner');
  const main = screen.getByRole('main');
  const footer = screen.getByRole('contentinfo');

  const allLogin = screen.getAllByRole('link', { name: /^iniciar sesión$/i });
  const allRegister = screen.getAllByRole('link', { name: /^crear cuenta$/i });
  expect(allLogin).toHaveLength(1);
  expect(allRegister).toHaveLength(1);
  expect(allLogin[0]?.getAttribute('href')).toBe('/ingresar');
  expect(allRegister[0]?.getAttribute('href')).toBe('/registro');

  expect(within(header).getByRole('link', { name: /^iniciar sesión$/i })).toBeTruthy();
  expect(within(header).getByRole('link', { name: /^crear cuenta$/i })).toBeTruthy();
  expect(within(main).queryByRole('link', { name: /^iniciar sesión$/i })).toBeNull();
  expect(within(main).queryByRole('link', { name: /^crear cuenta$/i })).toBeNull();
  expect(within(footer).queryByRole('link', { name: /^iniciar sesión$/i })).toBeNull();
  expect(within(footer).queryByRole('link', { name: /^crear cuenta$/i })).toBeNull();
}

describe('Experiencia pública multipágina y selector de tema', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renderiza / minimalista y navega por el navbar a /caracteristicas y /estudiantes con botones únicos en el navbar', async () => {
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

    // Portada minimalista en /
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /tu banca universitaria en pesos colombianos/i,
      }),
    ).toBeTruthy();

    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: /navegación principal/i })).toBeTruthy();
    expect(screen.getByRole('main')).toBeTruthy();
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    expect(screen.getByText(/vista previa ilustrativa/i)).toBeTruthy();
    expect(screen.getByText(/proyecto académico de ingeniería web/i)).toBeTruthy();
    expect(
      within(screen.getByRole('contentinfo')).getByRole('link', { name: /privacidad/i }),
    ).toBeTruthy();

    assertUniqueAuthButtonsInHeader();

    // Navegación a /caracteristicas desde el navbar
    const nav = screen.getByRole('navigation', { name: /navegación principal/i });
    await user.click(within(nav).getByRole('link', { name: /^características$/i }));

    expect(await screen.findByRole('heading', { level: 1, name: /qué hace nova/i })).toBeTruthy();
    expect(screen.getByText(/cuenta en cop exactos y libro contable/i)).toBeTruthy();
    expect(screen.getByText(/transferencias entre compañeros/i)).toBeTruthy();
    expect(screen.getByText(/tarjeta virtual simulada/i)).toBeTruthy();
    expect(screen.getByText(/metas de ahorro y presupuestos/i)).toBeTruthy();
    expect(screen.getByText(/gastos compartidos/i)).toBeTruthy();

    // Patrón «Muy pronto» sin acciones interactivas en Wallet cripto
    const cryptoHeading = screen.getByRole('heading', { name: /wallet cripto/i });
    const cryptoCard = cryptoHeading.closest('.nova-glass');
    expect(cryptoCard).not.toBeNull();
    if (cryptoCard instanceof HTMLElement) {
      expect(within(cryptoCard).getByText(/muy pronto/i)).toBeTruthy();
      expect(within(cryptoCard).queryByRole('button')).toBeNull();
      expect(within(cryptoCard).queryByRole('link')).toBeNull();
    }

    assertUniqueAuthButtonsInHeader();

    // Navegación a /estudiantes desde el navbar
    const navOnFeatures = screen.getByRole('navigation', { name: /navegación principal/i });
    await user.click(within(navOnFeatures).getByRole('link', { name: /^estudiantes$/i }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /diseñada para estudiantes universitarios en colombia/i,
      }),
    ).toBeTruthy();
    expect(screen.getByText(/verificación por correo institucional/i)).toBeTruthy();
    expect(screen.getByText(/sesiones seguras con cookies httponly/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /leer política de datos/i }).getAttribute('href')).toBe(
      '/privacidad',
    );

    assertUniqueAuthButtonsInHeader();
    controller.dispose();
  });

  it('alterna tema claro y oscuro con ThemeToggle actualizando data-theme, ARIA y localStorage', async () => {
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

  it('redirige automáticamente de / a /inicio cuando existe sesión activa y expone ThemeToggle en AppShell', async () => {
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
    expect(
      screen.getAllByRole('button', { name: /cambiar a modo (oscuro|claro)/i }).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
