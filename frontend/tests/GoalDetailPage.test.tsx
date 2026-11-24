import type { Goal, SavingsLimits } from '@nova/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../src/app/providers.tsx';
import GoalDetailPage from '../src/features/savings/pages/GoalDetailPage.tsx';
import { SAVINGS_MESSAGES } from '../src/lib/messages.ts';

const DEFAULT_SESSION = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'camila@universidad.edu.co',
    fullName: 'Camila Torres',
    alias: null,
  },
  expiresAt: '2026-12-31T23:59:59.000Z',
};

const DEFAULT_LIMITS: SavingsLimits = {
  minAmount: 1_000,
  maxAmount: 2_000_000,
  dailyLimit: 5_000_000,
  remainingToday: 5_000_000,
};

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    name: 'Viaje Santa Marta',
    targetAmount: 600_000,
    balance: 50_000,
    targetDate: '2027-06-01',
    status: 'active',
    completed: false,
    createdAt: '2026-11-20T15:00:00.000Z',
    closedAt: null,
    ...overrides,
  };
}

function renderDetail(goalId: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[`/metas/${goalId}`]}>
        <Routes>
          <Route path="/metas/:id" element={<GoalDetailPage />} />
          <Route path="/metas" element={<div>Lista metas</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('GoalDetailPage (spec 005 · T021 & T024)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('permite retirar y valida cuando se supera el saldo de la meta', async () => {
    const user = userEvent.setup();
    let currentGoal = makeGoal({ balance: 50_000 });
    let withdrawCalls = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/auth/session')) {
        return new Response(JSON.stringify(DEFAULT_SESSION), { status: 200 });
      }
      if (url.endsWith('/accounts/me')) {
        return new Response(
          JSON.stringify({
            id: '22222222-2222-4222-8222-222222222222',
            currency: 'COP',
            balance: 50_000,
            recentMovements: [],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/savings/limits')) {
        return new Response(JSON.stringify(DEFAULT_LIMITS), { status: 200 });
      }
      if (url.endsWith('/savings/goals') && method === 'GET') {
        return new Response(
          JSON.stringify({ items: [currentGoal], totalSaved: currentGoal.balance }),
          {
            status: 200,
          },
        );
      }
      if (url.includes('/movements')) {
        return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 });
      }
      if (url.includes('/withdrawals') && method === 'POST') {
        withdrawCalls += 1;
        currentGoal = { ...currentGoal, balance: 30_000 };
        return new Response(
          JSON.stringify({
            goal: currentGoal,
            availableBalance: 70_000,
            movement: {
              id: '33333333-3333-4333-8333-333333333331',
              transactionId: '44444444-4444-4444-8444-444444444441',
              type: 'savings_withdrawal',
              description: 'Retiro a tu cuenta',
              note: null,
              amount: -20_000,
              status: 'completed',
              createdAt: '2026-11-23T15:00:00.000Z',
            },
          }),
          { status: 201 },
        );
      }
      return new Response(null, { status: 404 });
    });

    renderDetail(currentGoal.id);

    await user.click(await screen.findByRole('button', { name: SAVINGS_MESSAGES.withdrawAction }));
    const dialog = await screen.findByRole('dialog');

    // Supera el saldo de la meta → validación clara sin llamar API
    await user.type(within(dialog).getByLabelText(SAVINGS_MESSAGES.amountLabel), '80000');
    await user.click(within(dialog).getByRole('button', { name: SAVINGS_MESSAGES.withdrawSubmit }));
    expect(await within(dialog).findByText(/la meta solo tiene/i)).toBeTruthy();
    expect(withdrawCalls).toBe(0);

    // Retiro válido de 20.000
    const input = within(dialog).getByLabelText(SAVINGS_MESSAGES.amountLabel);
    await user.clear(input);
    await user.type(input, '20000');
    await user.click(within(dialog).getByRole('button', { name: SAVINGS_MESSAGES.withdrawSubmit }));

    expect(await screen.findByText(/30\.000 de \$/)).toBeTruthy();
    expect(withdrawCalls).toBe(1);
  });

  it('permite editar la meta y cerrarla confirmando el monto exacto que regresa', async () => {
    const user = userEvent.setup();
    let currentGoal = makeGoal({ balance: 30_000 });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/auth/session')) {
        return new Response(JSON.stringify(DEFAULT_SESSION), { status: 200 });
      }
      if (url.endsWith('/accounts/me')) {
        return new Response(
          JSON.stringify({
            id: '22222222-2222-4222-8222-222222222222',
            currency: 'COP',
            balance: 70_000,
            recentMovements: [],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/savings/limits')) {
        return new Response(JSON.stringify(DEFAULT_LIMITS), { status: 200 });
      }
      if (url.endsWith('/savings/goals') && method === 'GET') {
        return new Response(
          JSON.stringify({
            items: [currentGoal],
            totalSaved: currentGoal.status === 'active' ? currentGoal.balance : 0,
          }),
          { status: 200 },
        );
      }
      if (url.includes('/movements')) {
        return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 });
      }
      if (url.endsWith(`/savings/goals/${currentGoal.id}`) && method === 'PATCH') {
        currentGoal = { ...currentGoal, name: 'Viaje Cartagena' };
        return new Response(JSON.stringify(currentGoal), { status: 200 });
      }
      if (url.endsWith(`/savings/goals/${currentGoal.id}/close`) && method === 'POST') {
        currentGoal = {
          ...currentGoal,
          balance: 0,
          status: 'closed',
          closedAt: '2026-11-23T16:00:00.000Z',
        };
        return new Response(
          JSON.stringify({ goal: currentGoal, availableBalance: 100_000, movement: null }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });

    renderDetail(currentGoal.id);

    // Editar nombre
    await user.click(await screen.findByRole('button', { name: SAVINGS_MESSAGES.editAction }));
    const editDialog = await screen.findByRole('dialog');
    const nameInput = within(editDialog).getByLabelText(SAVINGS_MESSAGES.nameLabel);
    await user.clear(nameInput);
    await user.type(nameInput, 'Viaje Cartagena');
    await user.click(
      within(editDialog).getByRole('button', { name: SAVINGS_MESSAGES.formEditSubmit }),
    );

    expect(await screen.findByRole('heading', { level: 2, name: 'Viaje Cartagena' })).toBeTruthy();

    // Cerrar mostrando el monto exacto que regresa ($ 30.000)
    await user.click(screen.getByRole('button', { name: SAVINGS_MESSAGES.closeAction }));
    const closeDialog = await screen.findByRole('dialog');
    expect(closeDialog.textContent).toMatch(/30\.000/);

    await user.click(
      within(closeDialog).getByRole('button', { name: SAVINGS_MESSAGES.closeDialogConfirm }),
    );

    // Una vez cerrada, no quedan botones de acción
    expect(await screen.findByText(SAVINGS_MESSAGES.closedReadOnlyNotice)).toBeTruthy();
    expect(screen.queryByRole('button', { name: SAVINGS_MESSAGES.depositAction })).toBeNull();
    expect(screen.queryByRole('button', { name: SAVINGS_MESSAGES.withdrawAction })).toBeNull();
    expect(screen.queryByRole('button', { name: SAVINGS_MESSAGES.editAction })).toBeNull();
    expect(screen.queryByRole('button', { name: SAVINGS_MESSAGES.closeAction })).toBeNull();
  });
});
