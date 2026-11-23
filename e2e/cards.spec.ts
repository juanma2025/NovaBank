/**
 * Pruebas E2E del flujo crítico constitucional de tarjeta virtual (spec 004 · T019 y T029).
 * Emite tarjeta, revela datos con contraseña, paga en la tienda demo, congela la tarjeta
 * y verifica que el siguiente pago se rechaza sin mover dinero (escritorio + 360 px).
 */
import type { CardList } from '@nova/shared';
import { expect, test } from '@playwright/test';

import {
  assertNoHorizontalOverflow,
  ensureVerifiedStudent,
  getMyBalance,
  seedTopup,
} from './helpers/auth.js';
import { HAS_FRONTEND } from './playwright.config.js';

const CARDS_EMAIL = 'tarjetas-e2e@nova-test.edu.co';

test.describe('tarjeta virtual y tienda demo (spec 004)', () => {
  test('emite tarjeta, revela datos con contraseña, paga en tienda y rechaza pagos al congelarla', async ({
    page,
  }) => {
    test.skip(!HAS_FRONTEND, 'El frontend todavía no está compilado en esta rama');

    await ensureVerifiedStudent(page, {
      email: CARDS_EMAIL,
      fullName: 'Juliana Castro',
    });

    // Garantiza cupo libre de tarjetas y saldo suficiente para pagar $12.000.
    const existingRes = await page.request.get('/api/v1/cards');
    expect(existingRes.status()).toBe(200);
    const existing = (await existingRes.json()) as CardList;
    for (const card of existing.items.filter((c) => c.status !== 'canceled')) {
      await page.request.post(`/api/v1/cards/${card.id}/cancel`);
    }

    let balanceBefore = await getMyBalance(page);
    if (balanceBefore < 30_000) {
      await seedTopup(page, 60_000);
      balanceBefore = await getMyBalance(page);
    }

    // 1. Emitir tarjeta en /tarjetas
    await page.goto('/tarjetas');
    await expect(
      page.getByRole('heading', { level: 1, name: /tarjetas virtuales/i }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page, '/tarjetas');

    await page.getByRole('button', { name: /nueva tarjeta/i }).click();
    const createDialog = page.getByRole('dialog');
    await createDialog.getByLabel(/nombre de la tarjeta/i).fill('Compras Campus');
    await createDialog.getByRole('button', { name: /emitir tarjeta/i }).click();

    await expect(page.getByText('Compras Campus').first()).toBeVisible();
    await expect(page.getByText('Activa').first()).toBeVisible();

    // 2. Entrar al detalle de la nueva tarjeta y revelar datos con contraseña
    await page
      .getByRole('link', { name: /ver detalle/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/tarjetas\/.+/);
    await assertNoHorizontalOverflow(page, '/tarjetas/:id');

    await page.getByRole('button', { name: /ver datos/i }).click();
    const revealDialog = page.getByRole('dialog');
    await revealDialog.getByLabel(/contraseña de tu cuenta/i).fill('ClaveSegura#2026');
    await revealDialog.getByRole('button', { name: /mostrar datos/i }).click();

    await expect(revealDialog.getByRole('button', { name: /copiar número/i })).toBeVisible();

    const ddValues = await revealDialog.locator('dd').allInnerTexts();
    const cardNumber = (ddValues[0] ?? '').replace(/\s+/g, '');
    const expiry = (ddValues[1] ?? '').trim();
    const cvv = (ddValues[2] ?? '').trim();
    expect(cardNumber).toMatch(/^9\d{15}$/);
    expect(expiry).toMatch(/^\d{2}\/\d{2}$/);
    expect(cvv).toMatch(/^\d{3}$/);

    await revealDialog.getByRole('button', { name: /ocultar y cerrar/i }).click();

    // 3. Pagar $12.000 en la tienda demo con esos datos
    await page.goto('/tienda');
    await expect(page.getByRole('heading', { level: 1, name: /tienda demo/i })).toBeVisible();
    await expect(page.getByText(/puedes pagar entre/i)).toBeVisible();
    await assertNoHorizontalOverflow(page, '/tienda');

    await page.getByLabel(/monto a pagar/i).fill('12000');
    await page.getByLabel(/número de tarjeta/i).fill(cardNumber);
    await page.getByLabel(/vencimiento/i).fill(expiry);
    await page.getByLabel(/cvv/i).fill(cvv);
    await page.getByRole('button', { name: /pagar ahora/i }).click();

    await expect(page.getByRole('heading', { name: /pago aprobado/i })).toBeVisible();
    expect(await getMyBalance(page)).toBe(balanceBefore - 12_000);

    // 4. Congelar la tarjeta y comprobar que el mismo pago se rechaza sin mover dinero (SC-002)
    await page.goto('/tarjetas');
    await page
      .getByRole('button', { name: /^congelar$/i })
      .first()
      .click();
    await expect(page.getByText('Congelada').first()).toBeVisible();

    await page.goto('/tienda');
    await expect(page.getByText(/puedes pagar entre/i)).toBeVisible();
    await page.getByLabel(/monto a pagar/i).fill('12000');
    await page.getByLabel(/número de tarjeta/i).fill(cardNumber);
    await page.getByLabel(/vencimiento/i).fill(expiry);
    await page.getByLabel(/cvv/i).fill(cvv);
    await page.getByRole('button', { name: /pagar ahora/i }).click();

    await expect(page.getByText(/la tarjeta no está activa/i)).toBeVisible();
    expect(await getMyBalance(page)).toBe(balanceBefore - 12_000);
  });
});
