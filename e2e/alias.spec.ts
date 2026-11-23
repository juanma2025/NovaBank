/**
 * Pruebas E2E de alias en perfil y transferencia usando alias (spec 003, US2 · T026).
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import {
  assertNoHorizontalOverflow,
  ensureVerifiedStudent,
  getMyBalance,
  seedTopup,
} from './helpers/auth.js';
import { HAS_FRONTEND } from './playwright.config.js';

test.describe('alias y perfil (spec 003 · US2)', () => {
  test('B asigna un alias en /perfil, A le transfiere usando @alias y B puede quitarlo con confirmación', async ({
    browser,
  }) => {
    test.skip(!HAS_FRONTEND, 'El frontend todavía no está compilado en esta rama');

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      const alias = `nova_${randomUUID().slice(0, 8)}`;

      await ensureVerifiedStudent(pageA, {
        email: 'emisor-e2e@nova-test.edu.co',
        fullName: 'Carlos Gómez',
      });
      await ensureVerifiedStudent(pageB, {
        email: 'destino-e2e@nova-test.edu.co',
        fullName: 'Laura Díaz',
      });
      const balanceBBefore = await getMyBalance(pageB);

      // B configura su alias en /perfil
      await pageB.goto('/perfil');
      await expect(pageB.getByRole('heading', { level: 1, name: /tu perfil/i })).toBeVisible();
      await assertNoHorizontalOverflow(pageB, '/perfil');

      await pageB.getByLabel(/elige tu alias/i).fill(`@${alias}`);
      await pageB.getByRole('button', { name: /guardar alias/i }).click();
      await expect(pageB.getByText(`@${alias}`).first()).toBeVisible();

      // A garantiza saldo y transfiere $10.000 usando el alias de B
      if ((await getMyBalance(pageA)) < 20_000) {
        await seedTopup(pageA, 30_000);
      }
      await pageA.goto('/enviar');
      await pageA.getByLabel(/correo institucional o alias/i).fill(`@${alias}`);
      await pageA.getByRole('button', { name: /buscar destinatario/i }).click();
      await expect(pageA.getByText('Laura D.')).toBeVisible();

      await pageA.getByLabel(/monto a enviar/i).fill('10000');
      await pageA.getByRole('button', { name: /^continuar$/i }).click();
      await pageA
        .getByRole('dialog')
        .getByRole('button', { name: /confirmar envío/i })
        .click();
      await expect(pageA.getByRole('heading', { name: /transferencia enviada/i })).toBeVisible();

      // B verifica el ingreso y luego quita su alias con confirmación
      expect(await getMyBalance(pageB)).toBe(balanceBBefore + 10_000);

      await pageB.goto('/perfil');
      await pageB.getByRole('button', { name: /^quitar alias$/i }).click();
      const dialog = pageB.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: /sí, quitar alias/i }).click();
      await expect(pageB.getByText(/sin alias asignado/i)).toBeVisible();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
