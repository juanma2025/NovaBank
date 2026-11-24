/**
 * Pruebas E2E de la pantalla de inicio (spec 002, US1 · T027 y SC-001/SC-006).
 * Verifica cuenta nueva con saldo $0, estado vacío, tarjeta «Muy pronto» sin llamadas a la API,
 * persistencia de ocultar saldo tras recargar y ausencia de desbordamiento en escritorio y 360 px.
 */
import { expect, test } from '@playwright/test';

import {
  assertNoHorizontalOverflow,
  registerVerifiedStudent,
  uniqueStudentEmail,
} from './helpers/auth.js';
import { HAS_FRONTEND } from './playwright.config.js';

test.describe('pantalla de inicio (spec 002 · US1)', () => {
  test('cuenta nueva muestra $0 en < 2 s, estado vacío, «Muy pronto» sin API y saldo ocultable persistente', async ({
    page,
  }) => {
    test.skip(!HAS_FRONTEND, 'El frontend todavía no está compilado en esta rama');

    await registerVerifiedStudent(page, {
      email: uniqueStudentEmail('inicio'),
      fullName: 'Sofía Morales',
    });

    // SC-001: saldo visible en menos de 2 s después de iniciar sesión.
    const startedAt = Date.now();
    await page.goto('/inicio');
    await expect(page.getByRole('heading', { level: 1, name: /hola, sofía/i })).toBeVisible();
    await expect(page.getByText(/^\$\s*0$/)).toBeVisible();
    expect(Date.now() - startedAt).toBeLessThan(2_000);

    // Estado vacío con invitación a recargar y tarjeta «Muy pronto».
    await expect(page.getByText(/aún no tienes movimientos/i)).toBeVisible();
    await expect(
      page
        .getByRole('main')
        .getByRole('link', { name: /^recargar$/i })
        .first(),
    ).toHaveAttribute('href', '/recargar');
    await expect(page.getByRole('heading', { name: /wallet cripto/i })).toBeVisible();
    await expect(page.getByText(/muy pronto/i)).toBeVisible();

    await assertNoHorizontalOverflow(page, '/inicio');

    // Tarjeta «Muy pronto»: diálogo informativo sin realizar llamadas a la API (FR-017).
    let apiCallsDuringComingSoon = 0;
    const onRequest = (req: { url: () => string }) => {
      if (req.url().includes('/api/v1/')) apiCallsDuringComingSoon += 1;
    };
    page.on('request', onRequest);

    await page.getByRole('button', { name: /wallet cripto/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/próxima fase de nova/i)).toBeVisible();
    await dialog.getByRole('button', { name: /entendido/i }).click();
    await expect(dialog).toBeHidden();

    page.off('request', onRequest);
    expect(apiCallsDuringComingSoon).toBe(0);

    // Ocultar saldo y verificar persistencia al recargar la página (FR-016).
    const hideBtn = page.getByRole('button', { name: /ocultar saldo/i });
    await expect(hideBtn).toHaveAttribute('aria-pressed', 'false');
    await hideBtn.click();

    await expect(page.getByRole('button', { name: /mostrar saldo/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('••••••')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /mostrar saldo/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('••••••')).toBeVisible();

    await page.getByRole('button', { name: /mostrar saldo/i }).click();
    await expect(page.getByText(/^\$\s*0$/)).toBeVisible();
  });
});
