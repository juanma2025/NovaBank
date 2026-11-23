/**
 * Pruebas E2E de recarga simulada (spec 002, US2 · T034).
 * Verifica validación de rango, resumen con aviso de dinero de demostración,
 * doble clic en «Confirmar» idempotente (una sola recarga) y actualización de saldo y movimiento.
 */
import { expect, test } from '@playwright/test';

import { assertNoHorizontalOverflow, ensureVerifiedStudent, getMyBalance } from './helpers/auth.js';
import { HAS_FRONTEND } from './playwright.config.js';

test.describe('recarga simulada (spec 002 · US2)', () => {
  test('valida rango, muestra aviso de demostración y aplica una sola recarga ante doble clic en Confirmar', async ({
    page,
  }) => {
    test.skip(!HAS_FRONTEND, 'El frontend todavía no está compilado en esta rama');

    await ensureVerifiedStudent(page, {
      email: 'recarga-e2e@nova-test.edu.co',
      fullName: 'Mateo Rivera',
    });
    const balanceBefore = await getMyBalance(page);

    await page.goto('/recargar');
    await expect(page.getByRole('heading', { level: 1, name: /recargar cuenta/i })).toBeVisible();
    await expect(page.getByText(/dinero de demostración/i).first()).toBeVisible();
    await expect(page.getByText(/puedes recargar entre/i)).toBeVisible();
    await assertNoHorizontalOverflow(page, '/recargar');

    const amountInput = page.getByLabel(/monto a recargar/i);
    const continueBtn = page.getByRole('button', { name: /^continuar$/i });

    // Monto menor al mínimo ($1.000) muestra aviso y bloquea avance.
    await amountInput.fill('500');
    await continueBtn.click();
    await expect(page.getByText(/el monto debe estar entre/i)).toBeVisible();

    // Monto mayor al máximo ($500.000) muestra aviso y bloquea avance.
    await amountInput.fill('600000');
    await continueBtn.click();
    await expect(page.getByText(/el monto debe estar entre/i)).toBeVisible();

    // Elegir monto sugerido $50.000 y abrir diálogo de confirmación.
    await page.getByRole('button', { name: /^\$\s*50\.000$/ }).click();
    await continueBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/^\$\s*50\.000$/)).toBeVisible();
    await expect(dialog.getByText(/dinero de demostración/i).first()).toBeVisible();

    // Retraso breve en la petición para ejercitar doble clic rápido sobre «Confirmar recarga».
    let topupRequestsCount = 0;
    await page.route('**/api/v1/topups', async (route) => {
      if (route.request().method() === 'POST') {
        topupRequestsCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      await route.continue();
    });

    const confirmBtn = dialog.getByRole('button', { name: /confirmar recarga/i });
    await confirmBtn.dblclick();

    await expect(page.getByRole('heading', { name: /recarga aplicada/i })).toBeVisible();
    await expect(page.getByText(/\$\s*50\.000/).first()).toBeVisible();
    expect(topupRequestsCount).toBe(1);

    // Al volver al inicio, el saldo aumentó exactamente $50.000 y aparece el movimiento.
    await page
      .getByRole('link', { name: /volver al inicio/i })
      .last()
      .click();
    await expect(page).toHaveURL(/\/inicio$/);
    expect(await getMyBalance(page)).toBe(balanceBefore + 50_000);

    const movementsList = page.getByRole('list', { name: /lista de movimientos/i });
    await expect(movementsList.getByText(/recarga simulada/i).first()).toBeVisible();
    await expect(movementsList.getByText(/\+\$\s*50\.000/).first()).toBeVisible();
  });
});
