import type { Goal, GoalList, SavingsLimits } from '@nova/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../src/app/providers.tsx';
import GoalsPage from '../src/features/savings/pages/GoalsPage.tsx';
import { ApiError } from '../src/lib/http-client.ts';
import { ERROR_MESSAGES, SAVINGS_MESSAGES } from '../src/lib/messages.ts';

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
    targetDate: null,
    status: 'active',
    completed: false,
    createdAt: '2026-11-20T15:00:00.000Z',
    closedAt: null,
    ...overrides,
  };
}

function mockFetch({
  goalList,
  balance = 100_000,
  createError,
  depositError,
}: {
  goalList: GoalList;
  balance?: number;
  createError?: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  depositError?: {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
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
          balance,
          recentMovements: [],
        }),
        { status: 200 },
      );
    }
    if (url.endsWith('/savings/limits')) {
      return new Response(JSON.stringify(DEFAULT_LIMITS), { status: 200 });
    }
    if (url.endsWith('/savings/goals') && method === 'GET') {
      return new Response(JSON.stringify(goalList), { status: 200 });
    }
    if (url.endsWith('/savings/goals') && method === 'POST') {
      if (createError) {
        return new Response(
          JSON.stringify({
            error: {
              code: createError.code,
              message: createError.message,
              requestId: '99999999-9999-4999-8999-999999999991',
              ...(createError.details ? { details: createError.details } : {}),
            },
          }),
          { status: createError.status, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify(makeGoal({ balance: 0 })), { status: 201 });
    }
    if (url.includes('/deposits') && method === 'POST') {
      if (depositError) {
        return new Response(
          JSON.stringify({
            error: {
              code: depositError.code,
              message: depositError.message,
              requestId: '99999999-9999-4999-8999-999999999992',
              ...(depositError.details ? { details: depositError.details } : {}),
            },
          }),
          { status: depositError.status, headers: { 'content-type': 'application/json' } },
        );
      }
    }
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), {
      status: 404,
    });
  });
}

function renderGoalsPage() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/metas']}>
        <Routes>
          <Route path="/metas" element={<GoalsPage />} />
          <Route path="/metas/:id" element={<div>Detalle meta</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('GoalsPage (spec 005 · T015)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('muestra estado vacío y valida nombre, objetivo y fecha pasada al crear', async () => {
    const user = userEvent.setup();
    mockFetch({ goalList: { items: [], totalSaved: 0 } });

    renderGoalsPage();

    expect(await screen.findByText(SAVINGS_MESSAGES.emptyTitle)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: SAVINGS_MESSAGES.emptyAction }));
    const dialog = await screen.findByRole('dialog');

    // Envío vacío valida nombre y objetivo
    await user.click(
      within(dialog).getByRole('button', { name: SAVINGS_MESSAGES.formCreateSubmit }),
    );
    expect(await within(dialog).findByText(SAVINGS_MESSAGES.validationNameRequired)).toBeTruthy();
    expect(within(dialog).getByText(SAVINGS_MESSAGES.validationTargetRequired)).toBeTruthy();

    // Fecha pasada rechazada en cliente
    await user.type(within(dialog).getByLabelText(SAVINGS_MESSAGES.nameLabel), 'Portátil nuevo');
    await user.type(within(dialog).getByLabelText(SAVINGS_MESSAGES.targetAmountLabel), '500000');
    await user.type(
      within(dialog).getByLabelText(SAVINGS_MESSAGES.targetDateInputLabel),
      '2020-01-01',
    );
    await user.click(
      within(dialog).getByRole('button', { name: SAVINGS_MESSAGES.formCreateSubmit }),
    );

    expect(await within(dialog).findByText(SAVINGS_MESSAGES.validationDatePast)).toBeTruthy();
  });

  it('muestra progreso en porcentaje, badge «Cumplida» y cerradas al final', async () => {
    const activeGoal = makeGoal({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      name: 'Viaje Santa Marta',
      balance: 50_000,
      targetAmount: 600_000,
    });
    const completedGoal = makeGoal({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      name: 'Libros semestre',
      balance: 250_000,
      targetAmount: 200_000,
      completed: true,
    });
    const closedGoal = makeGoal({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      name: 'Meta cerrada',
      balance: 0,
      targetAmount: 100_000,
      status: 'closed',
      closedAt: '2026-11-21T10:00:00.000Z',
    });

    mockFetch({
      goalList: { items: [closedGoal, activeGoal, completedGoal], totalSaved: 300_000 },
    });

    renderGoalsPage();

    expect(await screen.findByText('8 %')).toBeTruthy();
    expect(screen.getByText('100 %')).toBeTruthy();
    expect(screen.getByText(SAVINGS_MESSAGES.completedBadge)).toBeTruthy();
    expect(screen.getByText(SAVINGS_MESSAGES.closedBadge)).toBeTruthy();

    // Activas primero, cerradas al final
    const headings = screen.getAllByRole('heading', { level: 2 }).map((el) => el.textContent);
    expect(headings.indexOf('Viaje Santa Marta')).toBeLessThan(headings.indexOf('Meta cerrada'));
  });

  it('muestra GOAL_LIMIT_REACHED del servidor al crear la sexta meta', async () => {
    const user = userEvent.setup();
    const fiveGoals = Array.from({ length: 5 }, (_, idx) =>
      makeGoal({
        id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa0${idx + 1}`,
        name: `Meta ${idx + 1}`,
        balance: 10_000,
      }),
    );
    mockFetch({
      goalList: { items: fiveGoals, totalSaved: 50_000 },
      createError: {
        status: 422,
        code: 'GOAL_LIMIT_REACHED',
        message: ERROR_MESSAGES.GOAL_LIMIT_REACHED,
      },
    });

    renderGoalsPage();

    expect(await screen.findByText(SAVINGS_MESSAGES.maxReachedNotice)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: SAVINGS_MESSAGES.newGoalAction }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(SAVINGS_MESSAGES.nameLabel), 'Sexta meta');
    await user.type(within(dialog).getByLabelText(SAVINGS_MESSAGES.targetAmountLabel), '100000');
    await user.click(
      within(dialog).getByRole('button', { name: SAVINGS_MESSAGES.formCreateSubmit }),
    );

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain(ERROR_MESSAGES.GOAL_LIMIT_REACHED);
  });

  it('muestra INSUFFICIENT_FUNDS con disponible al aportar desde la tarjeta', async () => {
    const user = userEvent.setup();
    mockFetch({
      goalList: { items: [makeGoal()], totalSaved: 50_000 },
      balance: 100_000,
      depositError: {
        status: 422,
        code: 'INSUFFICIENT_FUNDS',
        message: 'Saldo insuficiente',
        details: { availableBalance: 10_000 },
      },
    });

    renderGoalsPage();

    await user.click(await screen.findByRole('button', { name: SAVINGS_MESSAGES.depositAction }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(/100\.000/);

    await user.type(within(dialog).getByLabelText(SAVINGS_MESSAGES.amountLabel), '50000');
    await user.click(within(dialog).getByRole('button', { name: SAVINGS_MESSAGES.depositSubmit }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toMatch(/10\.000/);
    expect(ApiError).toBeDefined();
  });
});
