import type { VerificationState } from '@nova/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { ResendButton } from '../src/features/auth/components/ResendButton.tsx';
import { CodeStep } from '../src/features/auth/steps/CodeStep.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeState(nowMs: number, overrides: Partial<VerificationState> = {}): VerificationState {
  return {
    purpose: 'registration',
    step: 'code',
    maskedEmail: 'an***@nova-test.edu.co',
    codeExpiresAt: new Date(nowMs + 15 * 60 * 1000).toISOString(),
    resendAvailableAt: new Date(nowMs + 60 * 1000).toISOString(),
    attemptsLeft: 5,
    completeBy: null,
    ...overrides,
  };
}

describe('ResendButton e integración en CodeStep (US4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T16:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra cuenta regresiva desde resendAvailableAt, deshabilitado mientras corre, y habilita al llegar a 0', async () => {
    const now = Date.now();
    const onResent = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(makeState(Date.now()), 202));

    render(
      <AppProviders queryClient={createAppQueryClient()}>
        <ResendButton
          resendAvailableAt={new Date(now + 10_000).toISOString()}
          onResent={onResent}
        />
      </AppProviders>,
    );

    const button = screen.getByRole('button', { name: /reenviar código en 10 s/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByRole('button', { name: /reenviar código en 5 s/i })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    const enabledButton = screen.getByRole('button', { name: /^reenviar código$/i });
    expect((enabledButton as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      fireEvent.click(enabledButton);
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/resend-verification',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
    expect(onResent).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/enviamos un código nuevo/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /reenviar código en 60 s/i })).toBeTruthy();
  });

  it('maneja RESEND_TOO_SOON reiniciando la cuenta regresiva con retryAfterSeconds', async () => {
    const now = Date.now();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'RESEND_TOO_SOON',
            message: 'Espera',
            requestId: REQUEST_ID,
            details: { retryAfterSeconds: 25 },
          },
        },
        429,
      ),
    );

    render(
      <AppProviders queryClient={createAppQueryClient()}>
        <ResendButton resendAvailableAt={new Date(now - 1_000).toISOString()} onResent={vi.fn()} />
      </AppProviders>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^reenviar código$/i }));
      await Promise.resolve();
    });

    expect(screen.getByText(/espera 25 segundos antes de pedir otro código/i)).toBeTruthy();
    const disabledButton = screen.getByRole('button', { name: /reenviar código en 25 s/i });
    expect((disabledButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('maneja CODE_SEND_LIMIT mostrando el tiempo de espera', async () => {
    const now = Date.now();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'CODE_SEND_LIMIT',
            message: 'Límite alcanzado',
            requestId: REQUEST_ID,
            details: { retryAfterSeconds: 1800 },
          },
        },
        429,
      ),
    );

    render(
      <AppProviders queryClient={createAppQueryClient()}>
        <ResendButton resendAvailableAt={new Date(now - 1_000).toISOString()} onResent={vi.fn()} />
      </AppProviders>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^reenviar código$/i }));
      await Promise.resolve();
    });

    expect(screen.getByText(/límite de códigos por hora/i)).toBeTruthy();
    expect(screen.getByText(/30 minutos/i)).toBeTruthy();
  });

  it('en CodeStep destaca «Pedir código nuevo» cuando el código vence o agota intentos', async () => {
    const now = Date.now();
    const state = makeState(now, {
      resendAvailableAt: new Date(now - 1_000).toISOString(),
      attemptsLeft: 0,
    });

    render(
      <AppProviders queryClient={createAppQueryClient()}>
        <CodeStep
          purpose="registration"
          state={state}
          isVerifying={false}
          onVerify={vi.fn()}
          onUseAnotherEmail={vi.fn()}
          onFlowLost={vi.fn()}
        />
      </AppProviders>,
    );

    const prominentButton = screen.getByRole('button', { name: /pedir código nuevo/i });
    expect(prominentButton).toBeTruthy();
    expect(prominentButton.getAttribute('data-prominent')).toBe('true');
  });
});
