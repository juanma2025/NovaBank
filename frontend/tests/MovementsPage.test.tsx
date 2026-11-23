import type { Movement, MovementsPage, SessionResponse } from '@nova/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { BALANCE_VISIBILITY_STORAGE_KEY } from '../src/features/accounts/services/balance-visibility-store.ts';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import MovementsPageView from '../src/features/movements/pages/MovementsPage.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

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

function makeMovement(index: number, amount: number): Movement {
  const padded = String(index).padStart(2, '0');
  return {
    id: `33333333-3333-4333-8333-3333333333${padded}`,
    transactionId: `44444444-4444-4444-8444-4444444444${padded}`,
    type: 'topup',
    description: `Recarga simulada #${index}`,
    note: null,
    amount,
    status: 'completed',
    createdAt: `2026-11-22T18:${padded}:00.000Z`,
  };
}

function renderMovements() {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, ACTIVE_SESSION);

  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={['/movimientos']}>
        <Routes>
          <Route path="/movimientos" element={<MovementsPageView />} />
          <Route path="/inicio" element={<p>Inicio</p>} />
          <Route path="/recargar" element={<p>Recargar</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('MovementsPage (US3 · T037)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('muestra la primera página y carga la siguiente con «Cargar más» usando el cursor sin repetidos', async () => {
    const user = userEvent.setup();
    const firstPage: MovementsPage = {
      items: [makeMovement(1, 50_000), makeMovement(2, 20_000)],
      nextCursor: 'cursor-page-2',
    };
    const secondPage: MovementsPage = {
      items: [makeMovement(3, 10_000)],
      nextCursor: null,
    };

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(jsonResponse(secondPage));

    renderMovements();

    expect(await screen.findByText('Recarga simulada #1')).toBeTruthy();
    expect(screen.getByText('Recarga simulada #2')).toBeTruthy();
    expect(screen.getByText(/\+\$\s*50\.000/)).toBeTruthy();

    const loadMoreButton = screen.getByRole('button', { name: /cargar más/i });
    await user.click(loadMoreButton);

    expect(await screen.findByText('Recarga simulada #3')).toBeTruthy();
    expect(screen.getByText(/llegaste al final de tu historial/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /cargar más/i })).toBeNull();

    const list = screen.getByRole('list', { name: /lista de movimientos/i });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);

    const secondCallUrl = String(fetchSpy.mock.calls[1]?.[0] ?? '');
    expect(secondCallUrl).toContain('cursor=cursor-page-2');
    expect(secondCallUrl).toContain('limit=20');
  });

  it('muestra el estado vacío con acceso a «Recargar» cuando no existen movimientos', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ items: [], nextCursor: null } satisfies MovementsPage),
    );

    renderMovements();

    expect(await screen.findByText(/aún no tienes movimientos/i)).toBeTruthy();
    const recargarLinks = screen.getAllByRole('link', { name: /recargar/i });
    expect(recargarLinks.some((link) => link.getAttribute('href') === '/recargar')).toBe(true);
  });

  it('muestra error al cargar la siguiente página sin perder las páginas ya cargadas y permite reintentar', async () => {
    const user = userEvent.setup();
    const firstPage: MovementsPage = {
      items: [makeMovement(1, 45_000), makeMovement(2, 15_000)],
      nextCursor: 'cursor-page-2',
    };
    const secondPage: MovementsPage = {
      items: [makeMovement(3, 8_000)],
      nextCursor: null,
    };

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(firstPage))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Error temporal cargando más movimientos.',
              requestId: REQUEST_ID,
            },
          },
          500,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(secondPage));

    renderMovements();

    expect(await screen.findByText('Recarga simulada #1')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /cargar más/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    // Las filas ya cargadas se conservan intactas.
    expect(screen.getByText('Recarga simulada #1')).toBeTruthy();
    expect(screen.getByText('Recarga simulada #2')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    await waitFor(() => {
      expect(screen.getByText('Recarga simulada #3')).toBeTruthy();
    });
    expect(screen.getByText('Recarga simulada #1')).toBeTruthy();
  });

  it('muestra error inicial con reintento y respeta el modo saldo oculto', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(BALANCE_VISIBILITY_STORAGE_KEY, 'true');

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'No pudimos consultar el historial.',
              requestId: REQUEST_ID,
            },
          },
          500,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [makeMovement(1, 75_000)],
          nextCursor: null,
        } satisfies MovementsPage),
      );

    renderMovements();

    expect(await screen.findByRole('alert')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Recarga simulada #1')).toBeTruthy();
    expect(screen.getByText('••••••')).toBeTruthy();
    expect(screen.queryByText(/\+\$\s*75\.000/)).toBeNull();
  });
});
