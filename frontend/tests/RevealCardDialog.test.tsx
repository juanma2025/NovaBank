import type { CardSecrets } from '@nova/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { RevealCardDialog } from '../src/features/cards/components/RevealCardDialog.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const CARD_ID = '33333333-3333-4333-8333-333333333331';

const SECRETS: CardSecrets = {
  number: '9012345678901235',
  expMonth: 11,
  expYear: 2030,
  cvv: '742',
};

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('RevealCardDialog (spec 004 · T022)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra datos tras contraseña, permite copiar, no los guarda en TanStack Query y los oculta a los 60 s', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonRes(SECRETS));
    const queryClient = createAppQueryClient();

    render(
      <AppProviders queryClient={queryClient}>
        <RevealCardDialog open cardId={CARD_ID} onClose={() => undefined} />
      </AppProviders>,
    );

    fireEvent.change(screen.getByLabelText(/contraseña de tu cuenta/i), {
      target: { value: 'ClaveSegura#2026' },
    });
    const form = screen.getByRole('button', { name: /mostrar datos/i }).closest('form');
    expect(form).not.toBeNull();
    await act(async () => {
      if (form) fireEvent.submit(form);
      await Promise.resolve();
    });

    expect(screen.getByText('9012 3456 7890 1235')).toBeTruthy();
    expect(screen.getByText('11/30')).toBeTruthy();
    expect(screen.getByText('742')).toBeTruthy();

    // Ningún dato sensible queda en la caché de TanStack Query ni en localStorage.
    const cachedJson = JSON.stringify(
      queryClient
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
    );
    expect(cachedJson).not.toContain(SECRETS.number);
    expect(cachedJson).not.toContain(SECRETS.cvv);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copiar número/i }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(SECRETS.number);
    expect(screen.getByText(/número copiado/i)).toBeTruthy();

    // Al transcurrir 60 s se ocultan automáticamente.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.queryByText('9012 3456 7890 1235')).toBeNull();
    expect(screen.getByLabelText(/contraseña de tu cuenta/i)).toBeTruthy();
  });

  it('maneja REAUTH_FAILED y REAUTH_LOCKED sin revelar datos', async () => {
    let calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        return jsonRes(
          { error: { code: 'REAUTH_FAILED', message: 'Incorrecta', requestId: REQUEST_ID } },
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
    });

    render(
      <AppProviders queryClient={createAppQueryClient()}>
        <RevealCardDialog open cardId={CARD_ID} onClose={() => undefined} />
      </AppProviders>,
    );

    fireEvent.change(screen.getByLabelText(/contraseña de tu cuenta/i), {
      target: { value: 'ClaveMala' },
    });
    fireEvent.click(screen.getByRole('button', { name: /mostrar datos/i }));
    expect(await screen.findByText(/la contraseña no es correcta/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /mostrar datos/i }));
    expect(await screen.findByText(/15 minutos/i)).toBeTruthy();
  });
});
