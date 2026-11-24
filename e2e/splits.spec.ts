import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import {
  assertNoHorizontalOverflow,
  ensureVerifiedStudent,
  getMyBalance,
  seedTopup,
} from './helpers/auth.js';

test.describe('Gastos compartidos (spec 007 · T016 & T022)', () => {
  test('dos contextos: Ana divide un gasto con Juan; Juan paga su parte y saldos/estado cuadran', async ({
    browser,
    contextOptions,
  }) => {
    const anaContext = await browser.newContext(contextOptions);
    const juanContext = await browser.newContext(contextOptions);
    const anaPage = await anaContext.newPage();
    const juanPage = await juanContext.newPage();

    try {
      const anaEmail = 'split-ana-e2e@nova-test.edu.co';
      const juanEmail = 'split-juan-e2e@nova-test.edu.co';

      await ensureVerifiedStudent(anaPage, { email: anaEmail, fullName: 'Ana División' });
      await ensureVerifiedStudent(juanPage, { email: juanEmail, fullName: 'Juan Participante' });

      // Asegura saldo disponible en Juan ≥ $ 40.000
      if ((await getMyBalance(juanPage)) < 40_000) {
        await seedTopup(juanPage, 50_000);
      }

      const anaBalanceBefore = await getMyBalance(anaPage);
      const juanBalanceBefore = await getMyBalance(juanPage);

      // 1. Ana crea división de $ 60.000 con Juan ($ 30.000 cada uno)
      const splitTitle = `Cena U ${randomUUID().slice(0, 4)}`;
      await anaPage.goto('/compartidos/nueva');
      await expect(
        anaPage.getByRole('heading', { name: /nueva división de gasto/i }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(anaPage, '/compartidos/nueva');

      await anaPage.getByLabel(/título del gasto/i).fill(splitTitle);
      await anaPage.getByLabel(/total del gasto/i).fill('60000');
      await anaPage.getByLabel(/correo institucional o alias/i).fill(juanEmail);
      await anaPage.getByRole('button', { name: /^agregar$/i }).click();

      await expect(anaPage.getByText(/suma exacta: \$\s*60\.000/i)).toBeVisible();
      await anaPage.getByRole('button', { name: /crear división/i }).click();

      await expect(anaPage).toHaveURL(/\/compartidos\/.+/);
      await expect(anaPage.getByRole('heading', { name: splitTitle })).toBeVisible();
      await assertNoHorizontalOverflow(anaPage, '/compartidos/:id (creador)');

      // Crear la división NUNCA mueve dinero (FR-004)
      expect(await getMyBalance(anaPage)).toBe(anaBalanceBefore);

      // 2. Juan ve su deuda en /compartidos, entra al detalle y pulsa «Pagar mi parte»
      await juanPage.goto('/compartidos');
      await expect(juanPage.getByRole('heading', { name: /gastos compartidos/i })).toBeVisible();
      await assertNoHorizontalOverflow(juanPage, '/compartidos');

      const splitHeading = juanPage.getByRole('heading', { level: 2, name: splitTitle });
      await expect(splitHeading).toBeVisible();
      const splitCard = splitHeading
        .locator('xpath=ancestor::div[contains(@class, "nova-glass")]')
        .first();
      await splitCard.getByRole('link', { name: /ver detalle/i }).click();

      await expect(juanPage).toHaveURL(/\/compartidos\/.+/);
      await juanPage.getByRole('button', { name: /pagar mi parte/i }).click();

      const payDialog = juanPage.getByRole('dialog');
      await expect(payDialog).toContainText(/\$\s*30\.000/);
      await payDialog.getByRole('button', { name: /confirmar y pagar/i }).click();

      await expect(payDialog).toBeHidden();
      await expect(juanPage.getByText(/pagaste tu parte correctamente/i)).toBeVisible();
      await expect(juanPage.getByText(/^completada$/i)).toBeVisible();

      // 3. Verificar saldos exactos en ambos estudiantes
      expect(await getMyBalance(juanPage)).toBe(juanBalanceBefore - 30_000);
      expect(await getMyBalance(anaPage)).toBe(anaBalanceBefore + 30_000);

      // 4. Ana recarga y ve la división completada y la parte de Juan pagada
      await anaPage.reload();
      await expect(anaPage.getByText(/^completada$/i)).toBeVisible();
      await expect(anaPage.getByText(/^pagada$/i)).toBeVisible();
    } finally {
      await anaContext.close();
      await juanContext.close();
    }
  });
});
