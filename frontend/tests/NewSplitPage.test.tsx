import type { RecipientPreview, Split, TransferLimits } from '@nova/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../src/app/providers.tsx';
import NewSplitPage from '../src/features/splits/pages/NewSplitPage.tsx';
import { ERROR_MESSAGES, SPLITS_MESSAGES } from '../src/lib/messages.ts';

const REQUEST_ID = '99999999-9999-4999-8999-999999999999';
const DEFAULT_LIMITS: TransferLimits = {
  minAmount: 1_000,
  maxAmount: 500_000,
  dailyLimit: 1_000_000,
  remainingToday: 1_000_000,
  reauthThreshold: 100_000,
};

const JUAN: RecipientPreview = {
  recipientId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Juan C. R.',
  maskedEmail: 'j***@ucc.edu.co',
};

const LAURA: RecipientPreview = {
  recipientId: '22222222-2222-4222-8222-222222222222',
  displayName: 'Laura M. S.',
  maskedEmail: 'l***@ucc.edu.co',
};

const CREATED_SPLIT: Split = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Almuerzo U',
  totalAmount: 10_000,
  creatorShare: 3_334,
  creatorName: 'Ana P. G.',
  role: 'creator',
  status: 'open',
  shares: [
    {
      id: '44444444-4444-4444-8444-444444444441',
      displayName: JUAN.displayName,
      amount: 3_333,
      status: 'pending',
      resolvedAt: null,
      lastRemindedAt: null,
      isMe: false,
    },
    {
      id: '44444444-4444-4444-8444-444444444442',
      displayName: LAURA.displayName,
      amount: 3_333,
      status: 'pending',
      resolvedAt: null,
      lastRemindedAt: null,
      isMe: false,
    },
  ],
  createdAt: '2026-11-23T15:00:00.000Z',
  closedAt: null,
};

function renderNewSplit() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/compartidos/nueva']}>
        <Routes>
          <Route path="/compartidos/nueva" element={<NewSplitPage />} />
          <Route path="/compartidos/:id" element={<div>Detalle división creada</div>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('NewSplitPage (spec 007 · T014)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('propone partes iguales con sobrante para el creador, valida suma desajustada y errores de participante', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.endsWith('/transfers/limits')) {
        return new Response(JSON.stringify(DEFAULT_LIMITS), { status: 200 });
      }
      if (url.includes('/transfers/recipient')) {
        if (url.includes('juan')) return new Response(JSON.stringify(JUAN), { status: 200 });
        if (url.includes('laura')) return new Response(JSON.stringify(LAURA), { status: 200 });
        return new Response(
          JSON.stringify({
            error: {
              code: 'RECIPIENT_NOT_FOUND',
              message: ERROR_MESSAGES.RECIPIENT_NOT_FOUND,
              requestId: REQUEST_ID,
            },
          }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/splits') && method === 'POST') {
        return new Response(JSON.stringify(CREATED_SPLIT), { status: 201 });
      }
      return new Response(null, { status: 404 });
    });

    renderNewSplit();

    await user.type(screen.getByLabelText(SPLITS_MESSAGES.titleLabel), 'Almuerzo U');
    await user.type(screen.getByLabelText(SPLITS_MESSAGES.totalInputLabel), '10000');

    // Participante inexistente muestra error en el campo
    const searchInput = screen.getByLabelText(SPLITS_MESSAGES.participantSearchLabel);
    await user.type(searchInput, 'nadie@ucc.edu.co');
    await user.click(screen.getByRole('button', { name: SPLITS_MESSAGES.addParticipantAction }));
    expect(await screen.findByText(ERROR_MESSAGES.RECIPIENT_NOT_FOUND)).toBeTruthy();

    // Agregar a Juan y Laura → propone $ 3.334 creador y $ 3.333 cada uno
    await user.clear(searchInput);
    await user.type(searchInput, 'juan@ucc.edu.co');
    await user.click(screen.getByRole('button', { name: SPLITS_MESSAGES.addParticipantAction }));
    expect(await screen.findByText(JUAN.displayName)).toBeTruthy();

    await user.type(searchInput, 'laura@ucc.edu.co');
    await user.click(screen.getByRole('button', { name: SPLITS_MESSAGES.addParticipantAction }));
    expect(await screen.findByText(LAURA.displayName)).toBeTruthy();

    // Duplicado bloqueado localmente
    await user.type(searchInput, 'juan@ucc.edu.co');
    await user.click(screen.getByRole('button', { name: SPLITS_MESSAGES.addParticipantAction }));
    expect(await screen.findByText(SPLITS_MESSAGES.duplicateParticipantError)).toBeTruthy();

    expect(
      (screen.getByLabelText(SPLITS_MESSAGES.creatorShareInputLabel) as HTMLInputElement).value,
    ).toBe('3.334');
    expect(screen.getByText(/suma exacta: \$\s*10\.000/i)).toBeTruthy();

    // Desajustar una parte → avisa y bloquea envío
    const juanInput = screen.getByLabelText(
      SPLITS_MESSAGES.participantShareInputLabel(JUAN.displayName),
    );
    await user.clear(juanInput);
    await user.type(juanInput, '5000');
    expect(screen.getByText(/no coincide con el total/i)).toBeTruthy();

    // Restaurar partes iguales y crear
    await user.click(screen.getByRole('button', { name: SPLITS_MESSAGES.splitEvenlyAction }));
    await user.click(screen.getByRole('button', { name: SPLITS_MESSAGES.createSubmit }));

    expect(await screen.findByText('Detalle división creada')).toBeTruthy();
  });
});
