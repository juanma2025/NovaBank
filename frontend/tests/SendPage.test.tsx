import {
  type AccountSummary,
  IDEMPOTENCY_HEADER,
  type RecipientPreview,
  type SessionResponse,
  type TransferLimits,
  type TransferResult,
} from '@nova/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { ACCOUNT_QUERY_KEY } from '../src/features/accounts/hooks/useAccount.ts';
import { MOVEMENTS_QUERY_KEY } from '../src/features/accounts/hooks/useMovements.ts';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import SendPage from '../src/features/transfers/pages/SendPage.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const RECIPIENT_ID = '55555555-5555-4555-8555-555555555555';

const SESSION: SessionResponse = {
  user: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'carlos.gomez@ucc.edu.co',
    fullName: 'Carlos Gómez',
  },
  session: {
    idleTimeoutSeconds: 900,
    idleWarningSeconds: 60,
    lastActivityAt: '2026-11-22T15:00:00.000Z',
    absoluteExpiresAt: '2026-11-23T03:00:00.000Z',
  },
};

const ACCOUNT: AccountSummary = {
  id: '33333333-3333-4333-8333-333333333333',
  currency: 'COP',
  balance: 300_000,
  recentMovements: [],
};

const LIMITS: TransferLimits = {
  minAmount: 1_000,
  maxAmount: 500_000,
  dailyLimit: 1_000_000,
  reauthThreshold: 200_000,
  remainingToday: 1_000_000,
};

const RECIPIENT: RecipientPreview = {
  recipientId: RECIPIENT_ID,
  displayName: 'Ana P. G.',
  maskedEmail: 'an***@ucc.edu.co',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function transferRes(amount: number, balance: number, note: string | null): TransferResult {
  return {
    balance,
    movement: {
      id: '66666666-6666-4666-8666-666666666666',
      transactionId: '77777777-7777-4777-8777-777777777777',
      type: 'transfer',
      description: 'Transferencia a Ana P. G.',
      note,
      amount: -amount,
      status: 'completed',
      createdAt: '2026-11-22T18:00:00.000Z',
    },
  };
}

function renderSend(queryClient = createAppQueryClient()) {
  queryClient.setQueryData(SESSION_QUERY_KEY, SESSION);
  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={['/enviar']}>
        <Routes>
          <Route path="/enviar" element={<SendPage />} />
          <Route path="/inicio" element={<p>Inicio</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('SendPage (spec 003 · T017)', () => {
  it('completa destinatario → monto y nota → confirmación sin contraseña e invalida cachés', async () => {
    const user = userEvent.setup();
    const queryClient = createAppQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/accounts/me')) return jsonRes(ACCOUNT);
      if (url.endsWith('/transfers/limits')) return jsonRes(LIMITS);
      if (url.includes('/transfers/recipient')) return jsonRes(RECIPIENT);
      if (url.endsWith('/transfers')) return jsonRes(transferRes(15_000, 285_000, 'Almuerzo'), 201);
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderSend(queryClient);

    await user.type(screen.getByLabelText(/correo institucional o alias/i), '@ana.perez');
    await user.click(screen.getByRole('button', { name: /buscar destinatario/i }));
    expect(await screen.findByText('Ana P. G.')).toBeTruthy();

    await user.type(screen.getByLabelText(/monto a enviar/i), '15000');
    await user.type(screen.getByLabelText(/nota \(opcional\)/i), 'Almuerzo');
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Almuerzo')).toBeTruthy();
    expect(within(dialog).queryByLabelText(/contraseña de tu cuenta/i)).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: /confirmar envío/i }));
    expect(await screen.findByRole('heading', { name: /transferencia enviada/i })).toBeTruthy();
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ACCOUNT_QUERY_KEY });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: MOVEMENTS_QUERY_KEY });
    });
  });

  it('muestra errores de destinatario, saldo insuficiente y tope diario', async () => {
    const user = userEvent.setup();
    let calls = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/accounts/me')) return jsonRes({ ...ACCOUNT, balance: 50_000 });
      if (url.endsWith('/transfers/limits')) return jsonRes({ ...LIMITS, remainingToday: 40_000 });
      if (url.includes('/transfers/recipient')) {
        calls += 1;
        if (calls === 1) {
          return jsonRes(
            { error: { code: 'RECIPIENT_NOT_FOUND', message: 'No', requestId: REQUEST_ID } },
            404,
          );
        }
        if (calls === 2) {
          return jsonRes(
            { error: { code: 'TRANSFER_TO_SELF', message: 'Self', requestId: REQUEST_ID } },
            422,
          );
        }
        return jsonRes(RECIPIENT);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderSend();

    const input = screen.getByLabelText(/correo institucional o alias/i);
    await user.type(input, 'nadie@ucc.edu.co');
    await user.click(screen.getByRole('button', { name: /buscar destinatario/i }));
    expect(await screen.findByText(/no encontramos un estudiante de nova/i)).toBeTruthy();

    await user.clear(input);
    await user.type(input, 'carlos.gomez@ucc.edu.co');
    await user.click(screen.getByRole('button', { name: /buscar destinatario/i }));
    expect(await screen.findByText(/no puedes enviarte dinero a ti mismo/i)).toBeTruthy();

    await user.clear(input);
    await user.type(input, '@ana.perez');
    await user.click(screen.getByRole('button', { name: /buscar destinatario/i }));
    expect(await screen.findByText('Ana P. G.')).toBeTruthy();

    await user.type(screen.getByLabelText(/monto a enviar/i), '45000');
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));
    expect(await screen.findByText(/puedes enviar hasta/i)).toBeTruthy();
  });

  it('pide contraseña sobre el umbral y maneja REAUTH_FAILED y REAUTH_LOCKED', async () => {
    const user = userEvent.setup();
    let posts = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/accounts/me')) return jsonRes(ACCOUNT);
      if (url.endsWith('/transfers/limits')) return jsonRes(LIMITS);
      if (url.includes('/transfers/recipient')) return jsonRes(RECIPIENT);
      if (url.endsWith('/transfers')) {
        posts += 1;
        if (posts === 1) {
          return jsonRes(
            { error: { code: 'REAUTH_FAILED', message: 'Mala', requestId: REQUEST_ID } },
            422,
          );
        }
        return jsonRes(
          {
            error: {
              code: 'REAUTH_LOCKED',
              message: 'Bloqueada',
              requestId: REQUEST_ID,
              details: { retryAfterSeconds: 900 },
            },
          },
          429,
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderSend();

    await user.type(screen.getByLabelText(/correo institucional o alias/i), '@ana.perez');
    await user.click(screen.getByRole('button', { name: /buscar destinatario/i }));
    expect(await screen.findByText('Ana P. G.')).toBeTruthy();

    await user.type(screen.getByLabelText(/monto a enviar/i), '250000');
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/contraseña de tu cuenta/i), 'ClaveMala#1');
    await user.click(within(dialog).getByRole('button', { name: /confirmar envío/i }));
    expect(await within(dialog).findByText(/la contraseña no es correcta/i)).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: /reintentar envío/i }));
    expect(await within(dialog).findByText(/15 minutos/i)).toBeTruthy();
  });

  it('reutiliza la misma Idempotency-Key al reintentar tras error de red', async () => {
    const user = userEvent.setup();
    const keys: string[] = [];
    let attempts = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/accounts/me')) return jsonRes(ACCOUNT);
      if (url.endsWith('/transfers/limits')) return jsonRes(LIMITS);
      if (url.includes('/transfers/recipient')) return jsonRes(RECIPIENT);
      if (url.endsWith('/transfers')) {
        keys.push(new Headers(init?.headers).get(IDEMPOTENCY_HEADER) ?? '');
        attempts += 1;
        if (attempts === 1) throw new TypeError('Failed to fetch');
        return jsonRes(transferRes(20_000, 280_000, null), 201);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderSend();

    await user.type(screen.getByLabelText(/correo institucional o alias/i), '@ana.perez');
    await user.click(screen.getByRole('button', { name: /buscar destinatario/i }));
    expect(await screen.findByText('Ana P. G.')).toBeTruthy();

    await user.type(screen.getByLabelText(/monto a enviar/i), '20000');
    await user.click(screen.getByRole('button', { name: /^continuar$/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /confirmar envío/i }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: /reintentar envío/i }));
    expect(await screen.findByRole('heading', { name: /transferencia enviada/i })).toBeTruthy();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});
