/**
 * Pruebas E2E del historial completo de movimientos (spec 002, US3 · T039).
 * Verifica «Ver todos» con primera página de 20 movimientos y «Cargar más» trayendo
 * la página siguiente sin repetidos ni desbordamiento horizontal (escritorio y 360 px).
 */
import type { MovementsPage } from '@nova/shared';
import { expect, type Page, test } from '@playwright/test';

import {
  assertNoHorizontalOverflow,
  registerVerifiedStudent,
  seedTopup,
  tryLoginStudent,
} from './helpers/auth.js';
import { HAS_FRONTEND } from './playwright.config.js';

const SEEDED_EMAIL = 'historial-e2e@nova-test.edu.co';
const TOTAL_SEEDED_MOVEMENTS = 21;

/**
 * Garantiza una cuenta verificada con al menos 21 recargas sembradas por la API.
 * Si la cuenta ya existe con ≥ 21 movimientos (ej. entre `chromium` y `movil-360`),
 * la reutiliza iniciando sesión sin consumir nuevamente el límite de tasa de recargas.
 */
async function ensureSeededMovementsAccount(page: Page): Promise<void> {
  const loggedIn = await tryLoginStudent(page, SEEDED_EMAIL);
  if (!loggedIn) {
    await registerVerifiedStudent(page, {
      email: SEEDED_EMAIL,
      fullName: 'Camila Ospina',
    });
  }

  const page1Res = await page.request.get('/api/v1/accounts/me/movements?limit=20');
  expect(page1Res.status()).toBe(200);
  const page1 = (await page1Res.json()) as MovementsPage;
  if (page1.nextCursor !== null) return;

  const missing = TOTAL_SEEDED_MOVEMENTS - page1.items.length;
  for (let index = 0; index < missing; index += 1) {
    // Montos distintos ($1.000, $2.000, ...) para facilitar la verificación visual y sin repetidos.
    await seedTopup(page, (page1.items.length + index + 1) * 1_000);
  }
}

test.describe('historial de movimientos (spec 002 · US3)', () => {
  test('con más de 20 recargas, «Ver todos» muestra 20 y «Cargar más» trae los siguientes sin repetidos', async ({
    page,
  }) => {
    test.skip(!HAS_FRONTEND, 'El frontend todavía no está compilado en esta rama');

    await ensureSeededMovementsAccount(page);

    await page.goto('/inicio');
    await expect(page.getByRole('link', { name: /ver todos/i })).toBeVisible();

    const page1Promise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/accounts/me/movements') &&
        res.request().method() === 'GET' &&
        res.status() === 200,
    );
    await page.getByRole('link', { name: /ver todos/i }).click();
    const page1Body = (await (await page1Promise).json()) as MovementsPage;

    await expect(page).toHaveURL(/\/movimientos$/);
    await expect(page.getByRole('heading', { level: 1, name: /^movimientos$/i })).toBeVisible();

    const list = page.getByRole('list', { name: /lista de movimientos/i });
    await expect(list.getByRole('listitem')).toHaveCount(20);
    await assertNoHorizontalOverflow(page, '/movimientos');

    const loadMoreBtn = page.getByRole('button', { name: /cargar más/i });
    await expect(loadMoreBtn).toBeVisible();

    const page2Promise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/accounts/me/movements') &&
        res.url().includes('cursor=') &&
        res.request().method() === 'GET' &&
        res.status() === 200,
    );
    await loadMoreBtn.click();
    const page2Body = (await (await page2Promise).json()) as MovementsPage;

    const combinedIds = [...page1Body.items, ...page2Body.items].map((item) => item.id);
    await expect(list.getByRole('listitem')).toHaveCount(combinedIds.length);
    await expect(page.getByText(/llegaste al final de tu historial/i)).toBeVisible();

    // Ningún movimiento se repite entre páginas (FR-020).
    expect(combinedIds.length).toBeGreaterThanOrEqual(TOTAL_SEEDED_MOVEMENTS);
    expect(new Set(combinedIds).size).toBe(combinedIds.length);
  });
});
