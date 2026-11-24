import {
  type AccountSummary,
  type CardPaymentResult,
  IDEMPOTENCY_HEADER,
  luhnCheckDigit,
  type PaymentLimits,
  type SessionResponse,
} from '@nova/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { ACCOUNT_QUERY_KEY } from '../src/features/accounts/hooks/useAccount.ts';
import { MOVEMENTS_QUERY_KEY } from '../src/features/accounts/hooks/useMovements.ts';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import { CARDS_QUERY_KEY } from '../src/features/cards/hooks/useCards.ts';
import StorePage from '../src/features/store/pages/StorePage.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const VALID_PAN_PREFIX = '901234567890123';
const VALID_PAN = `${VALID_PAN_PREFIX}${luhnCheckDigit(VALID_PAN_PREFIX)}`;
const INVALID_PAN = `${VALID_PAN_PREFIX}${(luhnCheckDigit(VALID_PAN_PREFIX) + 1) % 10}`;

const SESSION: SessionResponse = {
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

const ACCOUNT: AccountSummary = {
  id: '33333333-3333-4333-8333-333333333333',
  currency: 'COP',
  balance: 100_000,
  recentMovements: [],
};

const LIMITS: PaymentLimits = {
  minAmount: 1_000,
  maxAmount: 500_000,
  dailyLimit: 1_000_000,
  remainingToday: 1_000_000,
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makePaymentResult(amount: number, balance: number): CardPaymentResult {
  return {
    balance,
    cardLast4: VALID_PAN.slice(-4),
    movement: {
      id: '66666666-6666-4666-8666-666666666666',
      transactionId: '77777777-7777-4777-8777-777777777777',
      type: 'card_payment',
      description: `Compra en Librería del Campus · •••• ${VALID_PAN.slice(-4)}`,
      note: null,
      amount: -amount,
      status: 'completed',
      createdAt: '2026-11-22T18:00:00.000Z',
    },
  };
}

function renderStore(queryClient = createAppQueryClient()) {
  queryClient.setQueryData(SESSION_QUERY_KEY, SESSION);
  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={['/tienda']}>
        <Routes>
          <Route path="/tienda" element={<StorePage />} />
          <Route path="/inicio" element={<p>Inicio</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('StorePage (spec 004 · T027)', () => {
  it('valida Luhn y MM/AA mientras se escribe, reintenta con la misma Idempotency-Key e invalida cachés', async () => {
    const user = userEvent.setup();
    const queryClient = createAppQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const keys: string[] = [];
    let attempts = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/accounts/me')) return jsonRes(ACCOUNT);
      if (url.endsWith('/store/limits')) return jsonRes(LIMITS);
      if (url.endsWith('/store/payments')) {
        keys.push(new Headers(init?.headers).get(IDEMPOTENCY_HEADER) ?? '');
        attempts += 1;
        if (attempts === 1) throw new TypeError('Failed to fetch');
        return jsonRes(makePaymentResult(12_000, 88_000), 201);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderStore(queryClient);

    await user.click(await screen.findByRole('button', { name: /librería del campus/i }));
    await user.type(screen.getByLabelText(/monto a pagar/i), '12000');

    const panInput = screen.getByLabelText(/número de tarjeta/i);
    await user.type(panInput, INVALID_PAN);
    expect(screen.getByText(/número de tarjeta válido/i)).toBeTruthy();

    await user.clear(panInput);
    await user.type(panInput, VALID_PAN);

    const expInput = screen.getByLabelText(/vencimiento/i);
    await user.type(expInput, '1330');
    expect(screen.getByText(/formato mm\/aa/i)).toBeTruthy();

    await user.clear(expInput);
    await user.type(expInput, '1130');
    await user.type(screen.getByLabelText(/cvv/i), '742');

    await user.click(screen.getByRole('button', { name: /pagar ahora/i }));
    expect(await screen.findByRole('alert')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /reintentar pago/i }));
    expect(await screen.findByRole('heading', { name: /pago aprobado/i })).toBeTruthy();

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ACCOUNT_QUERY_KEY });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: MOVEMENTS_QUERY_KEY });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: CARDS_QUERY_KEY });
    });
  });

  it('muestra errores CARD_DECLINED, CARD_NOT_ACTIVE y CARD_PAYMENTS_LOCKED', async () => {
    const user = userEvent.setup();
    let call = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/accounts/me')) return jsonRes(ACCOUNT);
      if (url.endsWith('/store/limits')) return jsonRes(LIMITS);
      if (url.endsWith('/store/payments')) {
        call += 1;
        if (call === 1) {
          return jsonRes(
            { error: { code: 'CARD_DECLINED', message: 'Rechazado', requestId: REQUEST_ID } },
            422,
          );
        }
        if (call === 2) {
          return jsonRes(
            { error: { code: 'CARD_NOT_ACTIVE', message: 'Congelada', requestId: REQUEST_ID } },
            422,
          );
        }
        return jsonRes(
          {
            error: {
              code: 'CARD_PAYMENTS_LOCKED',
              message: 'Bloqueado',
              requestId: REQUEST_ID,
              details: { retryAfterSeconds: 900 },
            },
          },
          429,
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderStore();

    expect(await screen.findByText(/puedes pagar entre/i)).toBeTruthy();
    await user.type(screen.getByLabelText(/monto a pagar/i), '12000');
    await user.type(screen.getByLabelText(/número de tarjeta/i), VALID_PAN);
    await user.type(screen.getByLabelText(/vencimiento/i), '1130');
    await user.type(screen.getByLabelText(/cvv/i), '742');

    await user.click(screen.getByRole('button', { name: /pagar ahora/i }));
    expect(await screen.findByText(/pago rechazado/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /reintentar pago/i }));
    expect(await screen.findByText(/la tarjeta no está activa/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /reintentar pago/i }));
    expect(await screen.findByText(/15 minutos/i)).toBeTruthy();
  });
});
