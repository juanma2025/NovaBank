import { BUDGET_CATEGORIES, type BudgetAlert, type BudgetMonth } from '@nova/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../src/app/providers.tsx';
import { BudgetAlertToast } from '../src/features/budgets/components/BudgetAlertToast.tsx';
import { BudgetAlertBanner } from '../src/features/home/components/BudgetAlertBanner.tsx';
import { BUDGET_MESSAGES } from '../src/lib/messages.ts';

function makeFlaggedBudget(): BudgetMonth {
  return {
    month: '2026-11',
    totalSpent: 210_000,
    categories: BUDGET_CATEGORIES.map((category) => {
      if (category === 'food') {
        return { category, spent: 170_000, limit: 200_000, percent: 85, status: 'warning' };
      }
      if (category === 'transport') {
        return { category, spent: 40_000, limit: 30_000, percent: 133, status: 'exceeded' };
      }
      return { category, spent: 0, limit: null, percent: null, status: 'none' };
    }),
  };
}

describe('BudgetAlertBanner y BudgetAlertToast (spec 006 · T019)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('BudgetAlertBanner muestra las categorías en warning y exceeded con enlace a /presupuesto', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/budgets')) {
        return new Response(JSON.stringify(makeFlaggedBudget()), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    render(
      <AppProviders>
        <MemoryRouter>
          <BudgetAlertBanner />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(BUDGET_MESSAGES.bannerTitle)).toBeTruthy();
    expect(screen.getByText(/Comida cerca del tope \(85 %\)/)).toBeTruthy();
    expect(screen.getByText(/Transporte superado \(133 %\)/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: BUDGET_MESSAGES.bannerLink }).getAttribute('href'),
    ).toBe('/presupuesto');
  });

  it('BudgetAlertToast muestra alertas no vistas tras un gasto, las marca vistas y permite descartar', async () => {
    const user = userEvent.setup();
    const unseenAlert: BudgetAlert = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      month: '2026-11',
      category: 'food',
      threshold: 80,
      spent: 16_000,
      limit: 20_000,
      createdAt: '2026-11-23T15:00:00.000Z',
      seen: false,
    };
    const seenIds: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/budgets/alerts') && method === 'GET') {
        return new Response(JSON.stringify({ items: [unseenAlert] }), { status: 200 });
      }
      if (url.endsWith(`/budgets/alerts/${unseenAlert.id}/seen`) && method === 'POST') {
        seenIds.push(unseenAlert.id);
        return new Response(JSON.stringify({ ...unseenAlert, seen: true }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    render(
      <AppProviders>
        <MemoryRouter>
          <BudgetAlertToast active />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(
      await screen.findByText(/Te estás acercando a tu presupuesto de Comida \(80 %\)/),
    ).toBeTruthy();

    await waitFor(() => {
      expect(seenIds).toEqual([unseenAlert.id]);
    });

    await user.click(screen.getByRole('button', { name: BUDGET_MESSAGES.alertDismiss }));
    expect(screen.queryByText(/Te estás acercando/)).toBeNull();
  });
});
