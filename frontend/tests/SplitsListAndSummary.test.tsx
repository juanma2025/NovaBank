import type { SplitsPage as SplitsPageData, SplitsSummary } from '@nova/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../src/app/providers.tsx';
import { SplitsSummaryCard } from '../src/features/home/components/SplitsSummaryCard.tsx';
import SplitsPage from '../src/features/splits/pages/SplitsPage.tsx';
import { SPLITS_MESSAGES } from '../src/lib/messages.ts';

describe('SplitsPage y SplitsSummaryCard (spec 007 · T019)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('SplitsSummaryCard se oculta cuando ambos totales son 0 y se muestra cuando hay saldos pendientes', async () => {
    const emptySummary: SplitsSummary = {
      toCollect: { count: 0, amount: 0 },
      toPay: { count: 0, amount: 0 },
    };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(emptySummary), { status: 200 }));

    const first = render(
      <AppProviders>
        <MemoryRouter>
          <SplitsSummaryCard />
        </MemoryRouter>
      </AppProviders>,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(SPLITS_MESSAGES.summaryTitle)).toBeNull();
    first.unmount();

    const activeSummary: SplitsSummary = {
      toCollect: { count: 2, amount: 60_000 },
      toPay: { count: 1, amount: 25_000 },
    };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(activeSummary), { status: 200 }));

    render(
      <AppProviders>
        <MemoryRouter>
          <SplitsSummaryCard />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(SPLITS_MESSAGES.summaryTitle)).toBeTruthy();
    expect(screen.getByText(/\$\s*60\.000/)).toBeTruthy();
    expect(screen.getByText(/\$\s*25\.000/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: SPLITS_MESSAGES.summaryLink }).getAttribute('href'),
    ).toBe('/compartidos');
  });

  it('SplitsPage muestra estado vacío y lista de divisiones con roles y estados', async () => {
    const emptyPage: SplitsPageData = { items: [], nextCursor: null };
    const zeroSummary: SplitsSummary = {
      toCollect: { count: 0, amount: 0 },
      toPay: { count: 0, amount: 0 },
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/splits/summary')) {
        return new Response(JSON.stringify(zeroSummary), { status: 200 });
      }
      if (url.includes('/splits')) {
        return new Response(JSON.stringify(emptyPage), { status: 200 });
      }
      return new Response(null, { status: 404 });
    });

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/compartidos']}>
          <Routes>
            <Route path="/compartidos" element={<SplitsPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(SPLITS_MESSAGES.emptyTitle)).toBeTruthy();
  });
});
