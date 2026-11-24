import { IDEMPOTENCY_HEADER, type SessionResponse, type TopupLimits } from '@nova/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { ACCOUNT_QUERY_KEY } from '../src/features/accounts/hooks/useAccount.ts';
import { MOVEMENTS_QUERY_KEY } from '../src/features/accounts/hooks/useMovements.ts';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import TopupPage from '../src/features/topups/pages/TopupPage.tsx';

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

const DEFAULT_LIMITS: TopupLimits = {
  minAmount: 1_000,
  maxAmount: 500_000,
  dailyLimit: 2_000_000,
  remainingToday: 1_500_000,
};

function makeTopupResult(amount: number, balance: number) {
  return {
    movement: {
      id: '44444444-4444-4444-8444-444444444444',
      transactionId: '55555555-5555-4555-8555-555555555555',
      type: 'topup' as const,
      description: 'Recarga simulada',
      note: null,
      amount,
      status: 'completed' as const,
      createdAt: '2026-11-22T16:00:00.000Z',
    },
    balance,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderTopup() {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, SAMPLE_SESSION);

  return {
    queryClient,
    ...render(
      <AppProviders queryClient={queryClient}>
        <MemoryRouter initialEntries={['/recargar']}>
          <Routes>
            <Route path="/recargar" element={<TopupPage />} />
            <Route path="/inicio" element={<p>Inicio</p>} />
            <Route path="/movimientos" element={<p>Movimientos</p>} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    ),
  };
}

function getIdempotencyHeader(
  call: [RequestInfo | URL, RequestInit?] | undefined,
): string | undefined {
  const headers = call?.[1]?.headers as Record<string, string> | undefined;
  return headers?.[IDEMPOTENCY_HEADER];
}

describe('TopupPage (US2 · T031)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('muestra aviso de dinero de demostración, aplica montos sugeridos, confirma e invalida account y movements', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(DEFAULT_LIMITS, 200))
      .mockResolvedValueOnce(jsonResponse(makeTopupResult(50_000, 50_000), 201))
      .mockResolvedValueOnce(jsonResponse({ ...DEFAULT_LIMITS, remainingToday: 1_450_000 }, 200));

    const { queryClient } = renderTopup();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    expect(await screen.findByText(/puedes recargar entre/i)).toBeTruthy();
    expect(screen.getAllByText(/dinero de demostración/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /\$\s*50\.000/i }));
    const input = screen.getByLabelText(/monto a recargar/i) as HTMLInputElement;
    expect(input.value).toBe('50.000');

    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toMatch(/dinero de demostración/i);
    expect(dialog.textContent).toMatch(/\$\s*50\.000/);

    await user.click(screen.getByRole('button', { name: /confirmar recarga/i }));

    expect(await screen.findByText(/recarga aplicada/i)).toBeTruthy();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ACCOUNT_QUERY_KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: MOVEMENTS_QUERY_KEY });
  });

  it('valida rango y tope diario contra los límites del servidor antes de abrir confirmación', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ ...DEFAULT_LIMITS, remainingToday: 40_000 }, 200),
    );

    renderTopup();

    await screen.findByText(/puedes recargar entre/i);
    const input = screen.getByLabelText(/monto a recargar/i);
    await user.type(input, '500');
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/entre \$\s*1\.000 y \$\s*500\.000/i);
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.clear(input);
    await user.type(input, '60000');
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/hasta \$\s*40\.000 hoy/i);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reutiliza la misma Idempotency-Key al reintentar tras error de red y usa una nueva en un intento nuevo', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(DEFAULT_LIMITS, 200))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(makeTopupResult(20_000, 20_000), 201))
      .mockResolvedValueOnce(jsonResponse({ ...DEFAULT_LIMITS, remainingToday: 1_480_000 }, 200))
      .mockResolvedValueOnce(jsonResponse(makeTopupResult(20_000, 40_000), 201))
      .mockResolvedValueOnce(jsonResponse({ ...DEFAULT_LIMITS, remainingToday: 1_460_000 }, 200));

    renderTopup();

    await screen.findByText(/puedes recargar entre/i);
    await user.click(screen.getByRole('button', { name: /\$\s*20\.000/i }));
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    // Primer intento falla por red
    await user.click(screen.getByRole('button', { name: /confirmar recarga/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();

    // Reintento del mismo intento
    await user.click(screen.getByRole('button', { name: /reintentar recarga/i }));
    expect(await screen.findByText(/recarga aplicada/i)).toBeTruthy();

    const firstKey = getIdempotencyHeader(fetchSpy.mock.calls[1]);
    const retryKey = getIdempotencyHeader(fetchSpy.mock.calls[2]);
    expect(firstKey).toBeTruthy();
    expect(retryKey).toBe(firstKey);

    // Nuevo intento debe usar una clave distinta
    await user.click(screen.getByRole('button', { name: /hacer otra recarga/i }));
    await user.click(screen.getByRole('button', { name: /\$\s*20\.000/i }));
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));
    await user.click(screen.getByRole('button', { name: /confirmar recarga/i }));
    expect(await screen.findByText(/recarga aplicada/i)).toBeTruthy();

    const secondAttemptKey = getIdempotencyHeader(fetchSpy.mock.calls[4]);
    expect(secondAttemptKey).toBeTruthy();
    expect(secondAttemptKey).not.toBe(firstKey);
  });

  it('muestra los errores del servidor TOPUP_DAILY_LIMIT y TOPUP_AMOUNT_OUT_OF_RANGE', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(DEFAULT_LIMITS, 200))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'TOPUP_DAILY_LIMIT',
              message: 'Tope diario',
              requestId: REQUEST_ID,
              details: { remainingToday: 15_000 },
            },
          },
          422,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'TOPUP_AMOUNT_OUT_OF_RANGE',
              message: 'Fuera de rango',
              requestId: REQUEST_ID,
              details: { minAmount: 5_000, maxAmount: 200_000 },
            },
          },
          422,
        ),
      );

    renderTopup();

    await screen.findByText(/puedes recargar entre/i);
    await user.click(screen.getByRole('button', { name: /\$\s*50\.000/i }));
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));
    await user.click(screen.getByRole('button', { name: /confirmar recarga/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/hasta \$\s*15\.000 hoy/i);
    });

    await user.click(screen.getByRole('button', { name: /reintentar recarga/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/entre \$\s*5\.000 y \$\s*200\.000/i);
    });
  });
});
