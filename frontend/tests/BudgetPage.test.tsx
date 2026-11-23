import {
  addMonths,
  bogotaMonth,
  BUDGET_CATEGORIES,
  type BudgetCategorySummary,
  type BudgetMonth,
  type BudgetTransfer,
} from '@nova/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../src/app/providers.tsx';
import BudgetPage from '../src/features/budgets/pages/BudgetPage.tsx';
import { BUDGET_MESSAGES } from '../src/lib/messages.ts';

const DEFAULT_SESSION = {
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'laura@universidad.edu.co',
    fullName: 'Laura Pérez',
    alias: null,
  },
  expiresAt: '2026-12-31T23:59:59.000Z',
};

function makeEmptyBudget(month: string): BudgetMonth {
  return {
    month,
    totalSpent: 0,
    categories: BUDGET_CATEGORIES.map((category) => ({
      category,
      spent: 0,
      limit: null,
      percent: null,
      status: 'none',
    })),
  };
}

function makeBudgetWithStatuses(month: string): BudgetMonth {
  const overrides: Partial<
    Record<BudgetCategorySummary['category'], Partial<BudgetCategorySummary>>
  > = {
    food: { spent: 165_000, limit: 200_000, percent: 82, status: 'warning' },
    transport: { spent: 95_000, limit: 80_000, percent: 118, status: 'exceeded' },
    books: { spent: 25_000, limit: 100_000, percent: 25, status: 'ok' },
  };
  return {
    month,
    totalSpent: 285_000,
    categories: BUDGET_CATEGORIES.map((category) => ({
      category,
      spent: 0,
      limit: null,
      percent: null,
      status: 'none',
      ...overrides[category],
    })),
  };
}

function renderBudgetPage() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/presupuesto']}>
        <Routes>
          <Route path="/presupuesto" element={<BudgetPage />} />
          <Route path="/inicio" element={<div>Inicio</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('BudgetPage (spec 006 · T015 & T024)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('muestra resumen vacío, valida tope fuera de rango y guarda tope en Comida', async () => {
    const user = userEvent.setup();
    const currentMonth = bogotaMonth(new Date());
    let currentBudget = makeEmptyBudget(currentMonth);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/auth/session')) {
        return new Response(JSON.stringify(DEFAULT_SESSION), { status: 200 });
      }
      if (url.includes('/budgets/transfers')) {
        return new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 });
      }
      if (url.includes('/budgets/limits/food') && method === 'PUT') {
        currentBudget = {
          ...currentBudget,
          categories: currentBudget.categories.map((cat) =>
            cat.category === 'food' ? { ...cat, limit: 200_000, percent: 0, status: 'ok' } : cat,
          ),
        };
        return new Response(JSON.stringify(currentBudget), { status: 200 });
      }
      if (url.includes('/budgets')) {
        return new Response(JSON.stringify(currentBudget), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    renderBudgetPage();

    expect(await screen.findByText(BUDGET_MESSAGES.emptyPromptTitle)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: BUDGET_MESSAGES.emptyPromptAction }));
    const dialog = await screen.findByRole('dialog');

    // Tope menor al mínimo ($ 1.000) bloqueado en cliente
    await user.type(within(dialog).getByLabelText(BUDGET_MESSAGES.limitInputLabel), '500');
    await user.click(within(dialog).getByRole('button', { name: BUDGET_MESSAGES.saveLimitAction }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();

    // Tope válido $ 200.000
    const input = within(dialog).getByLabelText(BUDGET_MESSAGES.limitInputLabel);
    await user.clear(input);
    await user.type(input, '200000');
    await user.click(within(dialog).getByRole('button', { name: BUDGET_MESSAGES.saveLimitAction }));

    expect(await screen.findByText('0 %')).toBeTruthy();
    expect(screen.getByText(BUDGET_MESSAGES.statusLabels.ok)).toBeTruthy();
  });

  it('muestra porcentajes, estados con texto, mes pasado solo lectura y reclasificación de transferencia', async () => {
    const user = userEvent.setup();
    const currentMonth = bogotaMonth(new Date());
    const previousMonth = addMonths(currentMonth, -1);
    const txId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
    let transfer: BudgetTransfer = {
      transactionId: txId,
      description: 'Transferencia a Ana P. G.',
      amount: 150_000,
      createdAt: '2026-11-20T15:00:00.000Z',
      category: 'transfers',
    };
    const putCalls: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/auth/session')) {
        return new Response(JSON.stringify(DEFAULT_SESSION), { status: 200 });
      }
      if (url.includes(`/budgets/transfers/${txId}/category`) && method === 'PUT') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          category: BudgetTransfer['category'];
        };
        putCalls.push(body.category);
        transfer = { ...transfer, category: body.category };
        return new Response(JSON.stringify(transfer), { status: 200 });
      }
      if (url.includes('/budgets/transfers')) {
        return new Response(JSON.stringify({ items: [transfer], nextCursor: null }), {
          status: 200,
        });
      }
      if (url.includes(`month=${previousMonth}`)) {
        return new Response(JSON.stringify(makeEmptyBudget(previousMonth)), { status: 200 });
      }
      if (url.includes('/budgets')) {
        return new Response(JSON.stringify(makeBudgetWithStatuses(currentMonth)), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    renderBudgetPage();

    expect(await screen.findByText('82 %')).toBeTruthy();
    expect(screen.getByText('118 %')).toBeTruthy();
    expect(screen.getByText('25 %')).toBeTruthy();
    expect(screen.getByText(BUDGET_MESSAGES.statusLabels.warning)).toBeTruthy();
    expect(screen.getByText(BUDGET_MESSAGES.statusLabels.exceeded)).toBeTruthy();
    expect(screen.getByText(BUDGET_MESSAGES.statusLabels.ok)).toBeTruthy();

    // Reclasificar transferencia enviada a «Otros»
    const catSelect = await screen.findByLabelText(
      BUDGET_MESSAGES.categorySelectLabel(transfer.description),
    );
    await user.selectOptions(catSelect, 'other');
    expect(putCalls).toEqual(['other']);

    // Cambiar al mes anterior → modo solo lectura sin botones «Poner tope»
    const monthSelect = screen.getByLabelText(BUDGET_MESSAGES.monthSelectorLabel);
    await user.selectOptions(monthSelect, previousMonth);
    expect(await screen.findByText(BUDGET_MESSAGES.pastMonthNotice)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /poner tope/i })).toBeNull();
  });
});
