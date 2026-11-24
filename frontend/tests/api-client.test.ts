import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  apiRequest,
  getLastServerContactAt,
  resetLastServerContactAt,
  setOnSessionExpired,
} from '../src/lib/api-client.ts';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('api-client', () => {
  beforeEach(() => {
    resetLastServerContactAt();
    setOnSessionExpired(null);
  });

  it('envía credentials same-origin, JSON en mutaciones y actualiza lastServerContactAt en 2xx', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));

    expect(getLastServerContactAt()).toBeNull();
    const result = await apiRequest<{ ok: boolean }>('/auth/test', {
      method: 'POST',
      body: { email: 'ana@ucc.edu.co' },
    });

    expect(result).toEqual({ ok: true });
    expect(getLastServerContactAt()).toEqual(expect.any(Number));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/test',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ email: 'ana@ucc.edu.co' }),
      }),
    );
  });

  it('parsea ErrorResponse del contrato en un ApiError con details y requestId', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'CODE_INVALID',
            message: 'El código no es válido.',
            requestId: REQUEST_ID,
            details: { attemptsLeft: 3 },
          },
        },
        422,
      ),
    );

    await expect(
      apiRequest('/auth/verify-email', { method: 'POST', body: { code: '123456' } }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      code: 'CODE_INVALID',
      status: 422,
      requestId: REQUEST_ID,
      details: { attemptsLeft: 3 },
    });
  });

  it('convierte fallas de red en ApiError con código NETWORK', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    let caught: unknown;
    try {
      await apiRequest('/health');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('NETWORK');
    expect((caught as ApiError).status).toBe(0);
  });

  it('ante ACCESS_TOKEN_EXPIRED llama a POST /auth/refresh (con navigator.locks) y reintenta una sola vez', async () => {
    const lockRequest = vi.fn(async (_name: string, cb: () => Promise<void>) => {
      await cb();
    });
    const originalLocks = navigator.locks;
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: lockRequest },
    });

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'ACCESS_TOKEN_EXPIRED',
              message: 'Token vencido',
              requestId: REQUEST_ID,
            },
          },
          401,
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ refreshed: true }, 200))
      .mockResolvedValueOnce(jsonResponse({ user: 'ok' }, 200));

    try {
      const data = await apiRequest<{ user: string }>('/auth/session');
      expect(data).toEqual({ user: 'ok' });
      expect(lockRequest).toHaveBeenCalledWith('nova-refresh', expect.any(Function));
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/auth/refresh');
    } finally {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: originalLocks,
      });
    }
  });

  it('no entra en bucle si el reintento vuelve a responder ACCESS_TOKEN_EXPIRED', async () => {
    const expiredBody = {
      error: {
        code: 'ACCESS_TOKEN_EXPIRED',
        message: 'Token vencido',
        requestId: REQUEST_ID,
      },
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(expiredBody, 401))
      .mockResolvedValueOnce(jsonResponse({ refreshed: true }, 200))
      .mockResolvedValueOnce(jsonResponse(expiredBody, 401));

    await expect(apiRequest('/auth/session')).rejects.toMatchObject({
      code: 'ACCESS_TOKEN_EXPIRED',
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('invoca el callback de SESSION_EXPIRED con details.reason cuando la sesión vence', async () => {
    const onExpired = vi.fn();
    setOnSessionExpired(onExpired);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Tu sesión terminó.',
            requestId: REQUEST_ID,
            details: { reason: 'idle' },
          },
        },
        401,
      ),
    );

    await expect(apiRequest('/auth/session')).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
      details: { reason: 'idle' },
    });
    expect(onExpired).toHaveBeenCalledWith('idle');
  });
});
