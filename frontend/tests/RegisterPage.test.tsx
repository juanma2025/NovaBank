import type { SessionResponse, VerificationState } from '@nova/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import RegisterPage from '../src/features/auth/pages/RegisterPage.tsx';
import HomePage from '../src/features/home/pages/HomePage.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeVerificationState(overrides: Partial<VerificationState> = {}): VerificationState {
  return {
    purpose: 'registration',
    step: 'code',
    maskedEmail: 'an***@nova-test.edu.co',
    codeExpiresAt: '2026-11-22T15:30:00.000Z',
    resendAvailableAt: '2026-11-22T15:16:00.000Z',
    attemptsLeft: 5,
    completeBy: null,
    ...overrides,
  };
}

const CREATED_SESSION: SessionResponse = {
  user: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'ana.perez@nova-test.edu.co',
    fullName: 'Ana María Pérez',
  },
  session: {
    idleTimeoutSeconds: 900,
    idleWarningSeconds: 60,
    lastActivityAt: '2026-11-22T15:15:00.000Z',
    absoluteExpiresAt: '2026-11-23T03:15:00.000Z',
  },
};

function renderRegister() {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, null);

  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={['/registro']}>
        <Routes>
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/inicio" element={<HomePage />} />
          <Route path="/ingresar" element={<p>Pantalla ingresar</p>} />
          <Route path="/privacidad" element={<p>Política</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('RegisterPage (US1)', () => {
  it('retoma el paso 1 cuando GET /auth/verification devuelve 404', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
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
    );

    renderRegister();

    expect(await screen.findByRole('heading', { name: /crea tu cuenta en nova/i })).toBeTruthy();
  });

  it('retoma el paso de código cuando GET /auth/verification devuelve step=code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(makeVerificationState({ step: 'code' }), 200),
    );

    renderRegister();

    expect(
      await screen.findByRole('heading', { name: /revisa tu correo institucional/i }),
    ).toBeTruthy();
    expect(screen.getByText(/an\*\*\*@nova-test\.edu\.co/i)).toBeTruthy();
  });

  it('retoma el paso de perfil cuando GET /auth/verification devuelve step=complete', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        makeVerificationState({
          step: 'complete',
          completeBy: '2026-11-22T15:45:00.000Z',
        }),
        200,
      ),
    );

    renderRegister();

    expect(await screen.findByRole('heading', { name: /completa tu perfil/i })).toBeTruthy();
  });

  it('muestra paso 1 si el flujo activo pertenece a password_reset', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(makeVerificationState({ purpose: 'password_reset', step: 'code' }), 200),
    );

    renderRegister();

    expect(await screen.findByRole('heading', { name: /crea tu cuenta en nova/i })).toBeTruthy();
  });

  it('impide continuar sin aceptar la política de tratamiento de datos', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
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
    );

    renderRegister();

    const emailInput = await screen.findByLabelText(/correo institucional/i);
    await user.type(emailInput, 'ana.perez@nova-test.edu.co');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    expect(
      await screen.findByText(/debes aceptar la política de tratamiento de datos/i),
    ).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('muestra DOMAIN_NOT_ALLOWED directamente en el campo de correo', async () => {
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
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'DOMAIN_NOT_ALLOWED',
              message: 'Dominio no permitido',
              requestId: REQUEST_ID,
            },
          },
          422,
        ),
      );

    renderRegister();

    const emailInput = await screen.findByLabelText(/correo institucional/i);
    await user.type(emailInput, 'ana@gmail.com');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    expect(await screen.findByText(/solo se aceptan correos institucionales/i)).toBeTruthy();
    expect(emailInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('muestra los intentos restantes cuando CODE_INVALID ocurre en el paso 2', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(makeVerificationState({ step: 'code' }), 200))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'CODE_INVALID',
              message: 'Código inválido',
              requestId: REQUEST_ID,
              details: { attemptsLeft: 3 },
            },
          },
          422,
        ),
      );

    renderRegister();

    const firstDigit = await screen.findByLabelText(/dígito 1 de 6/i);
    await user.click(firstDigit);
    await user.paste('123456');

    expect(await screen.findByText(/te quedan 3 intentos/i)).toBeTruthy();
  });

  it('actualiza las reglas de contraseña mientras se escribe y completa el registro navegando a /inicio moviendo el foco al título de cada paso', async () => {
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
      .mockResolvedValueOnce(jsonResponse(makeVerificationState({ step: 'code' }), 202))
      .mockResolvedValueOnce(
        jsonResponse(
          makeVerificationState({
            step: 'complete',
            completeBy: '2026-11-22T15:45:00.000Z',
          }),
          200,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(CREATED_SESSION, 201))
      .mockResolvedValueOnce(
        jsonResponse({
          id: '33333333-3333-4333-8333-333333333333',
          currency: 'COP',
          balance: 0,
          recentMovements: [],
        }),
      );

    renderRegister();

    // Paso 1
    const emailInput = await screen.findByLabelText(/correo institucional/i);
    await user.type(emailInput, 'ana.perez@nova-test.edu.co');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    // Paso 2: foco en el título del paso
    const step2Heading = await screen.findByRole('heading', {
      name: /revisa tu correo institucional/i,
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(step2Heading);
    });

    const firstDigit = screen.getByLabelText(/dígito 1 de 6/i);
    await user.click(firstDigit);
    await user.paste('654321');

    // Paso 3: foco en el título del paso
    const step3Heading = await screen.findByRole('heading', { name: /completa tu perfil/i });
    await waitFor(() => {
      expect(document.activeElement).toBe(step3Heading);
    });

    // Reglas de contraseña en vivo
    const passwordInput = screen.getByLabelText(/crea una contraseña/i);
    const minLengthRule = screen.getByText(/al menos 10 caracteres/i).closest('li');
    const emailRule = screen.getByText(/no puede contener tu correo/i).closest('li');

    await user.type(passwordInput, 'ana.perez');
    expect(minLengthRule?.getAttribute('data-status')).toBe('invalid');
    expect(emailRule?.getAttribute('data-status')).toBe('invalid');

    await user.clear(passwordInput);
    await user.type(passwordInput, 'ClaveSegura#2026');
    expect(minLengthRule?.getAttribute('data-status')).toBe('valid');
    expect(emailRule?.getAttribute('data-status')).toBe('valid');

    await user.type(screen.getByLabelText(/nombre completo/i), 'Ana María Pérez');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    // Navegación a /inicio con bienvenida «Hola, Ana»
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeTruthy();
  });
});
