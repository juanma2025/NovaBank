import type { VerificationState } from '@nova/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { PublicOnly } from '../src/app/PublicOnly.tsx';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import LoginPage from '../src/features/auth/pages/LoginPage.tsx';
import PasswordResetPage from '../src/features/auth/pages/PasswordResetPage.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeResetState(overrides: Partial<VerificationState> = {}): VerificationState {
  return {
    purpose: 'password_reset',
    step: 'code',
    maskedEmail: 'an***@nova-test.edu.co',
    codeExpiresAt: '2026-11-22T16:15:00.000Z',
    resendAvailableAt: '2026-11-22T16:01:00.000Z',
    attemptsLeft: 5,
    completeBy: null,
    ...overrides,
  };
}

function LoginWithProbe() {
  const location = useLocation();
  return (
    <>
      <p data-testid="login-url">{`${location.pathname}${location.search}`}</p>
      <LoginPage />
    </>
  );
}

function renderPasswordReset() {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, null);

  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={['/recuperar']}>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/recuperar" element={<PasswordResetPage />} />
            <Route path="/ingresar" element={<LoginWithProbe />} />
          </Route>
          <Route path="/registro" element={<p>Registro</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('PasswordResetPage (US3)', () => {
  it('retoma el paso correspondiente según GET /auth/verification y descarta un flujo de registration', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(makeResetState({ step: 'code' }), 200),
    );

    const { unmount } = renderPasswordReset();
    expect(
      await screen.findByRole('heading', { name: /ingresa el código de recuperación/i }),
    ).toBeTruthy();
    expect(screen.getByText(/an\*\*\*@nova-test\.edu\.co/i)).toBeTruthy();
    unmount();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        makeResetState({ step: 'complete', completeBy: '2026-11-22T16:30:00.000Z' }),
        200,
      ),
    );
    const { unmount: unmount2 } = renderPasswordReset();
    expect(await screen.findByRole('heading', { name: /crea una contraseña nueva/i })).toBeTruthy();
    unmount2();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(makeResetState({ purpose: 'registration', step: 'code' }), 200),
    );
    renderPasswordReset();
    expect(await screen.findByRole('heading', { name: /recupera tu contraseña/i })).toBeTruthy();
  });

  it('completa los tres pasos y navega a /ingresar?motivo=clave-cambiada moviendo el foco al título', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'VERIFICATION_NOT_FOUND',
              message: 'Sin flujo',
              requestId: REQUEST_ID,
            },
          },
          404,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(makeResetState({ step: 'code' }), 202))
      .mockResolvedValueOnce(
        jsonResponse(
          makeResetState({ step: 'complete', completeBy: '2026-11-22T16:30:00.000Z' }),
          200,
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    renderPasswordReset();

    // Paso 1: correo (sin checkbox de consentimiento)
    const emailInput = await screen.findByLabelText(/correo institucional/i);
    expect(screen.queryByRole('checkbox')).toBeNull();
    await user.type(emailInput, 'ana.perez@nova-test.edu.co');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    // Paso 2: código
    const step2Heading = await screen.findByRole('heading', {
      name: /ingresa el código de recuperación/i,
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(step2Heading);
    });

    const firstDigit = screen.getByLabelText(/dígito 1 de 6/i);
    await user.click(firstDigit);
    await user.paste('987654');

    // Paso 3: contraseña nueva
    const step3Heading = await screen.findByRole('heading', {
      name: /crea una contraseña nueva/i,
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(step3Heading);
    });

    await user.type(screen.getByLabelText(/contraseña nueva/i), 'NuevaClaveSegura#2026');
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }));

    await waitFor(() => {
      expect(screen.getByTestId('login-url').textContent).toBe('/ingresar?motivo=clave-cambiada');
    });
    expect(screen.getByText(/contraseña actualizada/i)).toBeTruthy();
  });

  it('muestra la regla common cuando el servidor responde PASSWORD_WEAK y vuelve al paso 1 si expira el flujo', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          makeResetState({ step: 'complete', completeBy: '2026-11-22T16:30:00.000Z' }),
          200,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'PASSWORD_WEAK',
              message: 'Contraseña débil',
              requestId: REQUEST_ID,
              details: { reasons: ['common'] },
            },
          },
          422,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'VERIFICATION_EXPIRED',
              message: 'Expirado',
              requestId: REQUEST_ID,
            },
          },
          422,
        ),
      );

    renderPasswordReset();

    const passwordInput = await screen.findByLabelText(/contraseña nueva/i);
    await user.type(passwordInput, 'password12345');
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }));

    expect(await screen.findByText(/contraseña común o fácil de adivinar/i)).toBeTruthy();

    await user.clear(passwordInput);
    await user.type(passwordInput, 'OtraClaveSegura#2026');
    await user.click(screen.getByRole('button', { name: /guardar contraseña/i }));

    expect(await screen.findByRole('heading', { name: /recupera tu contraseña/i })).toBeTruthy();
    expect(screen.getByText(/se acabó el tiempo para completar este paso/i)).toBeTruthy();
  });
});
