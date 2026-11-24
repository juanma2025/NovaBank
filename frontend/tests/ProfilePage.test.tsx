import type { Profile, SessionResponse } from '@nova/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppProviders, createAppQueryClient } from '../src/app/providers.tsx';
import { SESSION_QUERY_KEY } from '../src/features/auth/hooks/useSession.ts';
import ProfilePage from '../src/features/profile/pages/ProfilePage.tsx';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const ACTIVE_SESSION: SessionResponse = {
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderProfilePage() {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, ACTIVE_SESSION);

  return render(
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={['/perfil']}>
        <Routes>
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/inicio" element={<p>Inicio</p>} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('ProfilePage y alias (spec 003 · T024)', () => {
  it('valida el formato del alias mientras se escribe y muestra vista previa normalizada', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        fullName: 'Ana María Pérez',
        email: 'ana.perez@ucc.edu.co',
        alias: null,
      } satisfies Profile),
    );

    renderProfilePage();

    const aliasInput = await screen.findByLabelText(/elige tu alias/i);
    await user.type(aliasInput, '.invalido');
    expect(screen.getByText(/empezando y terminando con letra o número/i)).toBeTruthy();

    await user.clear(aliasInput);
    await user.type(aliasInput, '@Ana.Perez');
    expect(screen.getByText(/podrán encontrarte como @ana\.perez/i)).toBeTruthy();
  });

  it('muestra ALIAS_TAKEN en el campo y permite guardar un alias libre', async () => {
    const user = userEvent.setup();
    let putCalls = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/profile/me')) {
        return jsonResponse({
          fullName: 'Ana María Pérez',
          email: 'ana.perez@ucc.edu.co',
          alias: null,
        } satisfies Profile);
      }
      if (url.endsWith('/profile/me/alias') && init?.method === 'PUT') {
        putCalls += 1;
        if (putCalls === 1) {
          return jsonResponse(
            { error: { code: 'ALIAS_TAKEN', message: 'Ocupado', requestId: REQUEST_ID } },
            409,
          );
        }
        return jsonResponse({
          fullName: 'Ana María Pérez',
          email: 'ana.perez@ucc.edu.co',
          alias: 'ana.nova',
        } satisfies Profile);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderProfilePage();

    const aliasInput = await screen.findByLabelText(/elige tu alias/i);
    await user.type(aliasInput, 'ana.ocupado');
    await user.click(screen.getByRole('button', { name: /guardar alias/i }));
    expect(await screen.findByText(/ese alias no está disponible/i)).toBeTruthy();

    await user.clear(aliasInput);
    await user.type(aliasInput, '@Ana.Nova');
    await user.click(screen.getByRole('button', { name: /guardar alias/i }));
    expect(await screen.findByText(/tu alias @ana\.nova quedó guardado/i)).toBeTruthy();
  });

  it('exige confirmación en diálogo antes de quitar el alias con DELETE /profile/me/alias', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/profile/me')) {
        return jsonResponse({
          fullName: 'Ana María Pérez',
          email: 'ana.perez@ucc.edu.co',
          alias: 'ana.perez',
        } satisfies Profile);
      }
      if (url.endsWith('/profile/me/alias') && init?.method === 'DELETE') {
        return jsonResponse({
          fullName: 'Ana María Pérez',
          email: 'ana.perez@ucc.edu.co',
          alias: null,
        } satisfies Profile);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    renderProfilePage();

    expect(await screen.findByText('@ana.perez')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^quitar alias$/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/¿quitar tu alias\?/i)).toBeTruthy();
    expect(
      fetchSpy.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE',
      ),
    ).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: /sí, quitar alias/i }));

    expect(await screen.findByText(/quitaste tu alias/i)).toBeTruthy();
    expect(screen.getByText(/sin alias asignado/i)).toBeTruthy();
  });
});
