import { IDEMPOTENCY_HEADER, type Movement } from '@nova/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { AppShell } from '../src/components/AppShell.tsx';
import { AccountService } from '../src/features/accounts/services/account-service.ts';
import {
  BALANCE_VISIBILITY_STORAGE_KEY,
  BalanceVisibilityStore,
  type StorageLike,
} from '../src/features/accounts/services/balance-visibility-store.ts';
import { IdempotencyKeyManager } from '../src/features/accounts/services/idempotency-key-manager.ts';
import {
  MASKED_AMOUNT,
  MovementPresenter,
} from '../src/features/accounts/services/movement-presenter.ts';
import { TopupService } from '../src/features/accounts/services/topup-service.ts';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import { EmptyMovements } from '../src/features/home/components/EmptyMovements.tsx';
import { MovementList } from '../src/features/home/components/MovementList.tsx';
import { HttpClient } from '../src/lib/http-client.ts';
import { formatApiErrorMessage } from '../src/lib/messages.ts';

const plain = (text: string): string => text.replace(/\s+/g, ' ').trim();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_MOVEMENTS: Movement[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    transactionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    type: 'topup',
    description: 'Recarga simulada',
    note: null,
    amount: 50_000,
    status: 'completed',
    createdAt: '2026-11-22T15:30:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    transactionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    type: 'transfer',
    description: 'Transferencia a Ana P. G.',
    note: 'Almuerzo cafetería',
    amount: -18_500,
    status: 'pending',
    createdAt: '2026-11-22T18:10:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    transactionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    type: 'card_payment',
    description: 'Compra en Papelería Campus · •••• 1234',
    note: null,
    amount: -12_000,
    status: 'failed',
    createdAt: '2026-11-22T19:00:00.000Z',
  },
];

describe('Base POO de cuentas y libro contable (002 · Bloque 1)', () => {
  it('AccountService y TopupService invocan el contrato 002 con Idempotency-Key', async () => {
    const customFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          id: '44444444-4444-4444-8444-444444444444',
          currency: 'COP',
          balance: 50_000,
          recentMovements: [SAMPLE_MOVEMENTS[0]],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [SAMPLE_MOVEMENTS[0]],
          nextCursor: 'cursor-next-1',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          minAmount: 1_000,
          maxAmount: 500_000,
          dailyLimit: 2_000_000,
          remainingToday: 1_950_000,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            movement: SAMPLE_MOVEMENTS[0],
            balance: 100_000,
          },
          201,
        ),
      );

    const http = new HttpClient({ fetchImpl: customFetch });
    const accounts = new AccountService(http);
    const topups = new TopupService(http);

    const summary = await accounts.getMyAccount();
    expect(summary.balance).toBe(50_000);
    expect(summary.recentMovements).toHaveLength(1);

    const page = await accounts.listMyMovements({ cursor: 'abc', limit: 20 });
    expect(page.nextCursor).toBe('cursor-next-1');
    expect(customFetch.mock.calls[1]?.[0]).toBe(
      '/api/v1/accounts/me/movements?cursor=abc&limit=20',
    );

    const limits = await topups.getTopupLimits();
    expect(limits.remainingToday).toBe(1_950_000);

    const result = await topups.createTopup({ amount: 50_000 }, 'idem-key-12345678');
    expect(result.balance).toBe(100_000);
    expect(customFetch.mock.calls[3]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      headers: expect.objectContaining({
        [IDEMPOTENCY_HEADER]: 'idem-key-12345678',
        'Content-Type': 'application/json',
      }),
    });
  });

  it('BalanceVisibilityStore persiste en localStorage y tolera fallos de almacenamiento', () => {
    const map = new Map<string, string>();
    const workingStorage: StorageLike = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
    };
    const store = new BalanceVisibilityStore({ storage: workingStorage });
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.isHidden()).toBe(false);
    expect(store.toggle()).toBe(true);
    expect(map.get(BALANCE_VISIBILITY_STORAGE_KEY)).toBe('true');
    expect(listener).toHaveBeenCalledWith(true);

    const failingStorage: StorageLike = {
      getItem: () => {
        throw new Error('QuotaExceeded');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    const resilient = new BalanceVisibilityStore({ storage: failingStorage });
    expect(resilient.isHidden()).toBe(false);
    resilient.setHidden(true);
    expect(resilient.isHidden()).toBe(true);
  });

  it('IdempotencyKeyManager reutiliza la clave en el mismo intento y genera otra al reiniciar', () => {
    let seq = 0;
    const manager = new IdempotencyKeyManager(() => `uuid-${++seq}`);

    const first = manager.getOrCreateForAttempt('50000');
    const retry = manager.getOrCreateForAttempt('50000');
    expect(first).toBe('uuid-1');
    expect(retry).toBe('uuid-1');

    manager.reset();
    const nextAttempt = manager.getOrCreateForAttempt('50000');
    expect(nextAttempt).toBe('uuid-2');
  });

  it('MovementPresenter formatea COP, signos, America/Bogota, notas y máscara', () => {
    const presenter = new MovementPresenter();
    const first = SAMPLE_MOVEMENTS[0];
    const second = SAMPLE_MOVEMENTS[1];
    if (!first || !second) throw new Error('Fixtures faltantes');
    const credit = presenter.present(first, false);
    const debit = presenter.present(second, false);
    const masked = presenter.present(first, true);

    expect(plain(credit.formattedAmount)).toBe('+$ 50.000');
    expect(credit.statusLabel).toBeNull();
    expect(credit.note).toBeNull();

    expect(plain(debit.formattedAmount)).toBe('-$ 18.500');
    expect(debit.note).toBe('Almuerzo cafetería');
    expect(debit.statusLabel).toBe('Pendiente');

    expect(masked.formattedAmount).toBe(MASKED_AMOUNT);
    expect(plain(presenter.formatBalance(1_250_000, false))).toBe('$ 1.250.000');
    expect(presenter.formatBalance(1_250_000, true)).toBe(MASKED_AMOUNT);
  });

  it('formatApiErrorMessage construye mensajes claros para códigos de la spec 002', () => {
    expect(
      plain(
        formatApiErrorMessage('TOPUP_AMOUNT_OUT_OF_RANGE', {
          minAmount: 1_000,
          maxAmount: 500_000,
        }),
      ),
    ).toBe('El monto debe estar entre $ 1.000 y $ 500.000.');

    expect(plain(formatApiErrorMessage('TOPUP_DAILY_LIMIT', { remainingToday: 150_000 }))).toBe(
      'Superas el tope diario. Puedes recargar hasta $ 150.000 hoy.',
    );

    expect(formatApiErrorMessage('TOPUP_DAILY_LIMIT', { remainingToday: 0 })).toContain(
      'tope diario',
    );
    expect(formatApiErrorMessage('IDEMPOTENCY_KEY_REUSED')).toContain('otros datos');
  });

  it('MovementList, EmptyMovements y AppShell renderizan estados, notas, máscara y navegación', () => {
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, {
      user: {
        id: '99999999-9999-4999-8999-999999999999',
        email: 'ana@ucc.edu.co',
        fullName: 'Ana Pérez',
      },
      session: {
        idleTimeoutSeconds: 900,
        idleWarningSeconds: 60,
        lastActivityAt: '2026-11-22T15:00:00.000Z',
        absoluteExpiresAt: '2026-11-23T03:00:00.000Z',
      },
    });

    const { rerender } = render(
      <AppProviders queryClient={queryClient}>
        <MemoryRouter initialEntries={['/inicio']}>
          <AppShell>
            <MovementList movements={SAMPLE_MOVEMENTS} hideAmounts={false} />
            <EmptyMovements />
          </AppShell>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByText('Recarga simulada')).toBeTruthy();
    expect(screen.getByText('Almuerzo cafetería')).toBeTruthy();
    expect(screen.getByText('Pendiente')).toBeTruthy();
    expect(screen.getByText('Fallida')).toBeTruthy();
    expect(screen.getByText('Aún no tienes movimientos')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: /navegación principal/i })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: /navegación móvil/i })).toBeTruthy();

    rerender(
      <AppProviders queryClient={queryClient}>
        <MemoryRouter initialEntries={['/inicio']}>
          <AppShell>
            <MovementList movements={SAMPLE_MOVEMENTS} hideAmounts />
          </AppShell>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getAllByText(MASKED_AMOUNT)).toHaveLength(3);
  });
});
