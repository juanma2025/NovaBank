import { IDEMPOTENCY_HEADER, type Split, type TransferLimits } from '@nova/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../src/app/providers.tsx';
import SplitDetailPage from '../src/features/splits/pages/SplitDetailPage.tsx';
import { SPLITS_MESSAGES } from '../src/lib/messages.ts';

const REQUEST_ID = '99999999-9999-4999-8999-999999999999';
const SPLIT_ID = '33333333-3333-4333-8333-333333333333';
const SHARE_ID = '44444444-4444-4444-8444-444444444441';

const DEFAULT_LIMITS: TransferLimits = {
  minAmount: 1_000,
  maxAmount: 500_000,
  dailyLimit: 1_000_000,
  remainingToday: 1_000_000,
  reauthThreshold: 100_000,
};

function makeSplit(overrides: Partial<Split> = {}): Split {
  return {
    id: SPLIT_ID,
    title: 'Cena cumpleaños',
    totalAmount: 300_000,
    creatorShare: 150_000,
    creatorName: 'Ana P. G.',
    role: 'participant',
    status: 'open',
    shares: [
      {
        id: SHARE_ID,
        displayName: 'Juan C. R.',
        amount: 150_000,
        status: 'pending',
        resolvedAt: null,
        lastRemindedAt: null,
        isMe: true,
      },
    ],
    createdAt: '2026-11-23T15:00:00.000Z',
    closedAt: null,
    ...overrides,
  };
}

function renderDetail() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[`/compartidos/${SPLIT_ID}`]}>
        <Routes>
          <Route path="/compartidos/:id" element={<SplitDetailPage />} />
          <Route path="/compartidos" element={<div>Lista compartidos</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('SplitDetailPage (spec 007 · T014 & T019)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pide contraseña sobre el umbral y reutiliza la misma Idempotency-Key al reintentar tras error de red', async () => {
    const user = userEvent.setup();
    const usedKeys: string[] = [];
    let currentSplit = makeSplit();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/transfers/limits')) {
        return new Response(JSON.stringify(DEFAULT_LIMITS), { status: 200 });
      }
      if (url.endsWith(`/splits/${SPLIT_ID}`) && method === 'GET') {
        return new Response(JSON.stringify(currentSplit), { status: 200 });
      }
      if (url.endsWith(`/splits/${SPLIT_ID}/shares/me/pay`) && method === 'POST') {
        const headers = new Headers(init?.headers);
        const key = headers.get(IDEMPOTENCY_HEADER) ?? '';
        usedKeys.push(key);
        if (usedKeys.length === 1) {
          throw new TypeError('Failed to fetch');
        }
        currentSplit = {
          ...currentSplit,
          status: 'completed',
          shares: currentSplit.shares.map((s) => ({
            ...s,
            status: 'paid',
            resolvedAt: '2026-11-23T15:05:00.000Z',
          })),
        };
        return new Response(
          JSON.stringify({
            split: currentSplit,
            balance: 50_000,
            movement: {
              id: '55555555-5555-4555-8555-555555555551',
              transactionId: '66666666-6666-4666-8666-666666666661',
              type: 'transfer',
              description: 'Transferencia a Ana P. G.',
              note: 'Gasto compartido: Cena cumpleaños',
              amount: -150_000,
              status: 'completed',
              createdAt: '2026-11-23T15:05:00.000Z',
            },
          }),
          { status: 201 },
        );
      }
      if (url.endsWith('/budgets/alerts')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    renderDetail();

    await user.click(await screen.findByRole('button', { name: SPLITS_MESSAGES.payMyShareAction }));
    const dialog = await screen.findByRole('dialog');

    // Monto $ 150.000 > umbral $ 100.000 → exige contraseña
    await user.type(
      within(dialog).getByLabelText(SPLITS_MESSAGES.payDialogPasswordLabel),
      'ClaveSegura#2026',
    );
    await user.click(
      within(dialog).getByRole('button', { name: SPLITS_MESSAGES.payDialogConfirm }),
    );

    // Primer intento falla por red; segundo reintenta con la misma Idempotency-Key
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: SPLITS_MESSAGES.payDialogRetry }));

    expect(await screen.findByText(SPLITS_MESSAGES.paySuccessNotice)).toBeTruthy();
    expect(usedKeys).toHaveLength(2);
    expect(usedKeys[0]).toBe(usedKeys[1]);
    expect(usedKeys[0]?.length).toBeGreaterThanOrEqual(8);
  });

  it('permite al creador marcar pagada por fuera, manejar SPLIT_REMINDER_TOO_SOON y cancelar con confirmación', async () => {
    const user = userEvent.setup();
    let currentSplit = makeSplit({
      role: 'creator',
      shares: [
        {
          id: SHARE_ID,
          displayName: 'Juan C. R.',
          amount: 30_000,
          status: 'pending',
          resolvedAt: null,
          lastRemindedAt: null,
          isMe: false,
        },
        {
          id: '44444444-4444-4444-8444-444444444442',
          displayName: 'Laura M. S.',
          amount: 30_000,
          status: 'pending',
          resolvedAt: null,
          lastRemindedAt: null,
          isMe: false,
        },
      ],
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/transfers/limits')) {
        return new Response(JSON.stringify(DEFAULT_LIMITS), { status: 200 });
      }
      if (url.endsWith(`/splits/${SPLIT_ID}`) && method === 'GET') {
        return new Response(JSON.stringify(currentSplit), { status: 200 });
      }
      if (url.includes('/remind') && method === 'POST') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'SPLIT_REMINDER_TOO_SOON',
              message: 'Ya enviaste un recordatorio',
              requestId: REQUEST_ID,
              details: { retryAfterSeconds: 3600 },
            },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/mark-paid') && method === 'POST') {
        currentSplit = {
          ...currentSplit,
          shares: currentSplit.shares.map((s) =>
            s.id === SHARE_ID ? { ...s, status: 'paid_outside' } : s,
          ),
        };
        return new Response(JSON.stringify(currentSplit), { status: 200 });
      }
      if (url.endsWith(`/splits/${SPLIT_ID}/cancel`) && method === 'POST') {
        currentSplit = {
          ...currentSplit,
          status: 'canceled',
          shares: currentSplit.shares.map((s) =>
            s.status === 'pending' ? { ...s, status: 'canceled' } : s,
          ),
        };
        return new Response(JSON.stringify(currentSplit), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    renderDetail();

    // Recordatorio rechazado con SPLIT_REMINDER_TOO_SOON indicando hora
    const remindButtons = await screen.findAllByRole('button', {
      name: SPLITS_MESSAGES.remindAction,
    });
    const firstRemind = remindButtons[0];
    if (firstRemind) await user.click(firstRemind);
    expect(await screen.findByText(/podrás enviar otro a las/i)).toBeTruthy();

    // Marcar primera parte como pagada por fuera
    const markButtons = screen.getAllByRole('button', {
      name: SPLITS_MESSAGES.markPaidOutsideAction,
    });
    const firstMark = markButtons[0];
    if (firstMark) await user.click(firstMark);
    expect(await screen.findByText(SPLITS_MESSAGES.shareStatusLabels.paid_outside)).toBeTruthy();

    // Cancelar división con diálogo de confirmación
    await user.click(screen.getByRole('button', { name: SPLITS_MESSAGES.cancelSplitAction }));
    const cancelDialog = await screen.findByRole('dialog');
    await user.click(
      within(cancelDialog).getByRole('button', { name: SPLITS_MESSAGES.cancelDialogConfirm }),
    );

    expect(await screen.findAllByText(SPLITS_MESSAGES.splitStatusLabels.canceled)).toBeTruthy();
  });
});
