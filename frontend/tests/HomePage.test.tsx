import type { AccountSummary, SessionResponse } from '@nova/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import {
  BALANCE_VISIBILITY_STORAGE_KEY,
  BalanceVisibilityStore,
  type StorageLike,
} from '../src/features/accounts/services/balance-visibility-store.ts';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import HomePage from '../src/features/home/pages/HomePage.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const SAMPLE_SESSION: SessionResponse = {
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

const EMPTY_ACCOUNT: AccountSummary = {
  id: '33333333-3333-4333-8333-333333333333',
  currency: 'COP',
  balance: 0,
  recentMovements: [],
};

const POPULATED_ACCOUNT: AccountSummary = {
  id: '33333333-3333-4333-8333-333333333333',
  currency: 'COP',
  balance: 131_500,
  recentMovements: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      transactionId: '55555555-5555-4555-8555-555555555555',
      type: 'topup',
      description: 'Recarga simulada',
      note: null,
      amount: 150_000,
      status: 'completed',
      createdAt: '2026-11-22T15:30:00.000Z',
    },
    {
      id: '66666666-6666-4666-8666-666666666666',
      transactionId: '77777777-7777-4777-8777-777777777777',
      type: 'transfer',
      description: 'Transferencia a Carlos R.',
      note: 'Fotocopias parcial',
      amount: -18_500,
      status: 'completed',
      createdAt: '2026-11-22T17:15:00.000Z',
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderHome(store?: BalanceVisibilityStore) {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, SAMPLE_SESSION);

  return render(
    <AppProviders
      queryClient={queryClient}
      services={store ? { balanceVisibilityStore: store } : undefined}
    >
      <MemoryRouter initialEntries={['/inicio']}>
        <Routes>
          <Route path="/inicio" element={<HomePage />} />
          <Route path="/recargar" element={<p>Pantalla recargar</p>} />
          <Route path="/movimientos" element={<p>Pantalla movimientos</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('HomePage (US1 · T024)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('muestra el estado de carga con esqueleto accesible mientras consulta GET /accounts/me', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

    renderHome();

    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('muestra saldo $ 0, estado vacío con botón «Recargar» y tarjeta «Muy pronto» en cuenta nueva', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(EMPTY_ACCOUNT, 200));

    renderHome();

    expect(await screen.findByText(/\$\s*0/)).toBeTruthy();
    expect(screen.getByText(/aún no tienes movimientos/i)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /recargar/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/wallet cripto/i)).toBeTruthy();
    expect(screen.getByText(/muy pronto/i)).toBeTruthy();
  });

  it('muestra movimientos recientes con signo explícito, color semántico, nota y enlace «Ver todos»', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(POPULATED_ACCOUNT, 200));

    renderHome();

    expect(await screen.findByText(/\$\s*131\.500/)).toBeTruthy();
    expect(screen.getByText('Recarga simulada')).toBeTruthy();
    expect(screen.getByText('Transferencia a Carlos R.')).toBeTruthy();
    expect(screen.getByText('Fotocopias parcial')).toBeTruthy();

    const positiveAmount = screen.getByText(/\+\$\s*150\.000/);
    const negativeAmount = screen.getByText(/-\$\s*18\.500/);
    expect(positiveAmount.closest('.t-text-soft')?.className).toContain('text-success');
    expect(negativeAmount.closest('.t-text-soft')?.className).toContain('text-danger');

    const viewAllLink = screen.getByRole('link', { name: /ver todos/i });
    expect(viewAllLink.getAttribute('href')).toBe('/movimientos');
  });

  it('oculta y muestra el saldo y montos, persiste en localStorage y tolera fallos de localStorage', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(POPULATED_ACCOUNT, 200))
      .mockResolvedValueOnce(jsonResponse(POPULATED_ACCOUNT, 200));

    const firstRender = renderHome();
    expect(await screen.findByText(/\$\s*131\.500/)).toBeTruthy();

    const hideButton = screen.getByRole('button', { name: /ocultar saldo/i });
    expect(hideButton.getAttribute('aria-pressed')).toBe('false');

    await user.click(hideButton);

    expect(window.localStorage.getItem(BALANCE_VISIBILITY_STORAGE_KEY)).toBe('true');
    expect(
      screen.getByRole('button', { name: /mostrar saldo/i }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.queryByText(/\$\s*131\.500/)).toBeNull();
    expect(screen.queryByText(/\+\$\s*150\.000/)).toBeNull();
    expect(screen.getAllByText('••••••')).toHaveLength(3);

    firstRender.unmount();

    // Al recargar/remontar en el mismo dispositivo, el saldo y los montos siguen ocultos.
    const secondRender = renderHome();
    expect(await screen.findAllByText('••••••')).toHaveLength(3);
    expect(
      screen.getByRole('button', { name: /mostrar saldo/i }).getAttribute('aria-pressed'),
    ).toBe('true');
    secondRender.unmount();

    // Si localStorage lanza error, el botón sigue ocultando y mostrando en memoria.
    const brokenStorage: StorageLike = {
      getItem: () => {
        throw new Error('Blocked');
      },
      setItem: () => {
        throw new Error('Blocked');
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(POPULATED_ACCOUNT, 200));
    renderHome(new BalanceVisibilityStore({ storage: brokenStorage }));

    expect(await screen.findByText(/\$\s*131\.500/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /ocultar saldo/i }));
    expect(screen.getAllByText('••••••')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: /mostrar saldo/i }));
    expect(screen.getByText(/\$\s*131\.500/)).toBeTruthy();
  });

  it('la tarjeta «Muy pronto» abre un diálogo informativo sin llamar a la API', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(EMPTY_ACCOUNT, 200));

    renderHome();
    await screen.findByText(/\$\s*0/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const trigger = screen.getByRole('button', { name: /wallet cripto/i });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toMatch(/próxima fase/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /entendido/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('muestra Alert de error con «Reintentar» y recupera la cuenta al reintentar', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Error temporal',
              requestId: REQUEST_ID,
            },
          },
          500,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(POPULATED_ACCOUNT, 200));

    renderHome();

    expect(await screen.findByRole('alert')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    await waitFor(() => {
      expect(screen.getByText(/\$\s*131\.500/)).toBeTruthy();
    });
  });
});
