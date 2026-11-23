import type { Card, CardList, SessionResponse } from '@nova/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import { VirtualCard } from '../src/features/cards/components/VirtualCard.tsx';
import CardsPage from '../src/features/cards/pages/CardsPage.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

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
    id: '33333333-3333-4333-8333-333333333331',
    nickname: 'Compras en línea',
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

function renderCards() {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, SESSION);
  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={['/tarjetas']}>
        <Routes>
          <Route path="/tarjetas" element={<CardsPage />} />
          <Route path="/tarjetas/:id" element={<p>Detalle</p>} />
          <Route path="/tienda" element={<p>Tienda</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('CardsPage y VirtualCard (spec 004 · T016, T037)', () => {
  it('muestra estado vacío, permite emitir con nombre y congelar/descongelar', async () => {
    const user = userEvent.setup();
    let cards: Card[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/cards') && (!init?.method || init.method === 'GET')) {
        return jsonRes({ items: cards } satisfies CardList);
      }
      if (url.endsWith('/cards') && init?.method === 'POST') {
        const created = makeCard({ nickname: 'Suscripciones', status: 'active' });
        cards = [created];
        return jsonRes(created, 201);
      }
      if (url.endsWith('/freeze')) {
        cards = cards.map((c) => ({ ...c, status: 'frozen' }));
        return jsonRes(cards[0]);
      }
      if (url.endsWith('/unfreeze')) {
        cards = cards.map((c) => ({ ...c, status: 'active' }));
        return jsonRes(cards[0]);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderCards();

    expect(await screen.findByText(/aún no tienes tarjetas/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /emitir primera tarjeta/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/nombre de la tarjeta/i), 'Suscripciones');
    await user.click(within(dialog).getByRole('button', { name: /emitir tarjeta/i }));

    expect(await screen.findByText('Suscripciones')).toBeTruthy();
    expect(screen.getByText('•••• 4821')).toBeTruthy();
    expect(screen.getByText('Activa')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^congelar$/i }));
    expect(await screen.findByText('Congelada')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^descongelar$/i }));
    expect(await screen.findByText('Activa')).toBeTruthy();
  });

  it('muestra CARD_LIMIT_REACHED al intentar emitir una cuarta tarjeta', async () => {
    const user = userEvent.setup();
    const threeCards: Card[] = [
      makeCard({ id: '33333333-3333-4333-8333-333333333331', nickname: 'T1', last4: '1111' }),
      makeCard({ id: '33333333-3333-4333-8333-333333333332', nickname: 'T2', last4: '2222' }),
      makeCard({ id: '33333333-3333-4333-8333-333333333333', nickname: 'T3', last4: '3333' }),
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/cards') && (!init?.method || init.method === 'GET')) {
        return jsonRes({ items: threeCards });
      }
      if (url.endsWith('/cards') && init?.method === 'POST') {
        return jsonRes(
          { error: { code: 'CARD_LIMIT_REACHED', message: 'Máximo 3', requestId: REQUEST_ID } },
          422,
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderCards();

    expect(await screen.findByText(/3 de 3 tarjetas vigentes/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /nueva tarjeta/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/nombre de la tarjeta/i), 'Cuarta');
    await user.click(within(dialog).getByRole('button', { name: /emitir tarjeta/i }));

    expect(await within(dialog).findByText(/alcanzaste el máximo de 3 tarjetas/i)).toBeTruthy();
  });

  it('muestra «Vencida» en texto cuando expMonth/expYear ya pasaron en hora de Bogotá (T037)', () => {
    const expiredCard = makeCard({ expMonth: 10, expYear: 2026, status: 'active' });
    const validLastDay = makeCard({ expMonth: 11, expYear: 2026, status: 'active' });
    const bogotaNov = new Date('2026-11-23T17:00:00.000Z');

    const { rerender } = render(<VirtualCard card={expiredCard} now={bogotaNov} />);
    expect(screen.getByText('Vencida')).toBeTruthy();
    expect(screen.queryByText('Activa')).toBeNull();

    rerender(<VirtualCard card={validLastDay} now={bogotaNov} />);
    expect(screen.getByText('Activa')).toBeTruthy();
  });
});
