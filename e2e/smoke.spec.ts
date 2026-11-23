/**
 * Prueba de humo del workspace E2E (spec 001, T011): el servidor compilado arranca contra
 * `nova_e2e`, responde la API y, si el frontend está compilado, lo sirve en el mismo origen.
 */
import { expect, test } from '@playwright/test';

import { HAS_FRONTEND } from './playwright.config.js';

test.describe('humo', () => {
  test('la API responde y publica su contrato', async ({ request }) => {
    const health = await request.get('/api/v1/health');
    expect(health.ok()).toBe(true);
    expect(await health.json()).toEqual({ status: 'ok' });

    const openapi = await request.get('/api/v1/openapi.json');
    expect(openapi.ok()).toBe(true);
    const doc = (await openapi.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining(['/auth/register', '/accounts/me', '/transfers', '/cards']),
    );
  });

  test('una ruta de la API que no existe responde 404 con el formato de error', async ({
    request,
  }) => {
    const res = await request.get('/api/v1/no-existe');
    expect(res.status()).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  test('sirve el frontend en el mismo origen', async ({ page }) => {
    test.skip(!HAS_FRONTEND, 'El frontend todavía no está compilado en esta rama');
    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/Nova/);
  });
});
