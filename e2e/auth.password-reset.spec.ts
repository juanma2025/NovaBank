import { expect, test } from '@playwright/test';

import {
  assertNoHorizontalOverflow,
  registerVerifiedStudent,
  uniqueStudentEmail,
} from './helpers/auth.js';
import { listMessagesFor, waitForNewCode } from './helpers/mailpit.js';

const OLD_PASSWORD = 'ClaveInicial#2026';
const NEW_PASSWORD = 'ClaveActualizada#2026';

test.describe('Recuperación de contraseña (spec 001 · US3 · T074)', () => {
  test('dos contextos: recuperar en B cierra la sesión de A, rechaza la clave anterior y acepta la nueva', async ({
    browser,
    contextOptions,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Flujo multicontexto de recuperación cubierto en escritorio dentro del presupuesto de rate-limit',
    );

    const ctxA = await browser.newContext(contextOptions);
    const ctxB = await browser.newContext(contextOptions);
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      const email = uniqueStudentEmail('recuperar');
      await registerVerifiedStudent(pageA, {
        email,
        fullName: 'Lucía Recuperación',
        password: OLD_PASSWORD,
      });
      await pageA.goto('/inicio');
      await expect(pageA.getByRole('heading', { name: /hola, lucía/i })).toBeVisible();

      const priorIds = new Set((await listMessagesFor(pageB.request, email)).map((m) => m.ID));

      // Contexto B solicita recuperación en /recuperar
      await pageB.goto('/recuperar');
      await expect(pageB.getByRole('heading', { name: /recupera tu contraseña/i })).toBeVisible();
      await assertNoHorizontalOverflow(pageB, '/recuperar');

      await pageB.getByLabel(/correo institucional/i).fill(email);
      await pageB.getByRole('button', { name: /enviar código/i }).click();
      await expect(
        pageB.getByRole('heading', { name: /ingresa el código de recuperación/i }),
      ).toBeVisible();

      const { code } = await waitForNewCode(pageB.request, email, { excludeIds: priorIds });
      await pageB.getByLabel(/dígito 1 de 6/i).fill(code);

      await expect(
        pageB.getByRole('heading', { name: /crea una contraseña nueva/i }),
      ).toBeVisible();
      await pageB.getByLabel(/contraseña nueva/i).fill(NEW_PASSWORD);
      await pageB.getByRole('button', { name: /guardar contraseña/i }).click();

      await expect(pageB).toHaveURL(/\/ingresar\?motivo=clave-cambiada/);
      await expect(pageB.getByText(/contraseña actualizada/i)).toBeVisible();

      // Contraseña anterior falla en B
      await pageB.getByLabel(/correo institucional/i).fill(email);
      await pageB.getByLabel(/^contraseña$/i).fill(OLD_PASSWORD);
      await pageB.getByRole('button', { name: /^ingresar$/i }).click();
      await expect(pageB.getByRole('alert')).toContainText(/correo o contraseña incorrectos/i);

      // Contraseña nueva entra en B
      await pageB.getByLabel(/^contraseña$/i).fill(NEW_PASSWORD);
      await pageB.getByRole('button', { name: /^ingresar$/i }).click();
      await expect(pageB).toHaveURL(/\/inicio$/);

      // La sesión previa de A quedó revocada (FR-020c)
      await pageA.reload();
      await expect(pageA).toHaveURL(/\/ingresar/);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
