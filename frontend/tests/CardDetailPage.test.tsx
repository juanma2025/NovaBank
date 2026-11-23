import type { Card, CardList, CardPaymentsPage, SessionResponse } from '@nova/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import CardDetailPage from '../src/features/cards/pages/CardDetailPage.tsx';
import CardsPage from '../src/features/cards/pages/CardsPage.tsx';

const CARD_ID = '33333333-3333-4333-8333-333333333331';

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

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: CARD_ID,
    nickname: 'Compras U',
    last4: '4821',
    expMonth: 11,
    expYear: 2030,
    holderName: 'ANA MARÍA PÉREZ',
    status: 'active',
    createdAt: '2026-11-22T18:00:00.000Z',
    ...overrides,
  };
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CardDetailPage y orden de tarjetas canceladas (spec 004 · T032)', () => {
  it('permite renombrar y cancelar con confirmación; una tarjeta cancelada no ofrece acciones', async () => {
    const user = userEvent.setup();
    let card = makeCard();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/cards')) return jsonRes({ items: [card] } satisfies CardList);
      if (url.includes('/payments')) {
        return jsonRes({ items: [], nextCursor: null } satisfies CardPaymentsPage);
      }
      if (url.endsWith(`/cards/${CARD_ID}`) && init?.method === 'PATCH') {
        card = { ...card, nickname: 'Streaming' };
        return jsonRes(card);
      }
      if (url.endsWith(`/cards/${CARD_ID}/cancel`) && init?.method === 'POST') {
        card = { ...card, status: 'canceled' };
        return jsonRes(card);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const queryClient = createAppQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, SESSION);

    render(
      <AppProviders queryClient={queryClient}>
        <MemoryRouter initialEntries={[`/tarjetas/${CARD_ID}`]}>
          <Routes>
            <Route path="/tarjetas/:id" element={<CardDetailPage />} />
            <Route path="/tarjetas" element={<CardsPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Compras U' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^renombrar$/i }));
    const renameDialog = await screen.findByRole('dialog');
    const input = within(renameDialog).getByLabelText(/nombre de la tarjeta/i);
    await user.clear(input);
    await user.type(input, 'Streaming');
    await user.click(within(renameDialog).getByRole('button', { name: /guardar nombre/i }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Streaming' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /cancelar tarjeta/i }));
    const cancelDialog = await screen.findByRole('dialog');
    expect(within(cancelDialog).getByText(/¿cancelar esta tarjeta\?/i)).toBeTruthy();
    await user.click(within(cancelDialog).getByRole('button', { name: /sí, cancelar tarjeta/i }));

    expect(await screen.findByText(/esta tarjeta está cancelada/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /ver datos/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^renombrar$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /cancelar tarjeta/i })).toBeNull();
  });

  it('ordena tarjetas vigentes primero y canceladas al final en CardsPage', async () => {
    const canceled = makeCard({
      id: '33333333-3333-4333-8333-333333333339',
      nickname: 'Vieja cancelada',
      status: 'canceled',
      last4: '9999',
    });
    const active = makeCard({
      id: '33333333-3333-4333-8333-333333333338',
      nickname: 'Vigente activa',
      status: 'active',
      last4: '1234',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonRes({ items: [canceled, active] } satisfies CardList),
    );

    const queryClient = createAppQueryClient();
    queryClient.setQueryData(SESSION_QUERY_KEY, SESSION);

    render(
      <AppProviders queryClient={queryClient}>
        <MemoryRouter initialEntries={['/tarjetas']}>
          <Routes>
            <Route path="/tarjetas" element={<CardsPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    const activeEl = await screen.findByText('Vigente activa');
    const canceledEl = screen.getByText('Vieja cancelada');
    expect(
      activeEl.compareDocumentPosition(canceledEl) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
