/**
 * Pruebas E2E del flujo crítico constitucional de transferencias (spec 003, US1 · T021).
 * Dos contextos independientes (emisor A y destinataria B): envío por correo con doble clic
 * idempotente, nota en ambos movimientos, y envío > $200.000 exigiendo contraseña.
 */
import { expect, test } from '@playwright/test';

import {
  assertNoHorizontalOverflow,
  registerVerifiedStudent,
  seedTopup,
  uniqueStudentEmail,
} from './helpers/auth.js';
import { HAS_FRONTEND } from './playwright.config.js';

test.describe('transferencias entre estudiantes (spec 003 · US1)', () => {
  test('A envía a B por correo con doble clic idempotente y monto alto exige contraseña', async ({
    browser,
  }) => {
    test.skip(!HAS_FRONTEND, 'El frontend todavía no está compilado en esta rama');

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      const emailA = uniqueStudentEmail('emisor');
      const emailB = uniqueStudentEmail('destino');

      await registerVerifiedStudent(pageA, { email: emailA, fullName: 'Carlos Gómez' });
      await registerVerifiedStudent(pageB, { email: emailB, fullName: 'Laura Díaz' });

      // A recarga $300.000 para cubrir envío normal ($15.000) + envío con reauth ($210.000).
      await seedTopup(pageA, 300_000);

      await pageA.goto('/enviar');
      await expect(pageA.getByRole('heading', { level: 1, name: /enviar dinero/i })).toBeVisible();
      await assertNoHorizontalOverflow(pageA, '/enviar');

      // Paso 1: buscar destinataria por correo institucional
      await pageA.getByLabel(/correo institucional o alias/i).fill(emailB);
      await pageA.getByRole('button', { name: /buscar destinatario/i }).click();
      await expect(pageA.getByText('Laura D.')).toBeVisible();

      // Paso 2: monto $15.000 + nota
      await pageA.getByLabel(/monto a enviar/i).fill('15000');
      await pageA.getByLabel(/nota \(opcional\)/i).fill('Almuerzo campus');
      await pageA.getByRole('button', { name: /^continuar$/i }).click();

      const dialog1 = pageA.getByRole('dialog');
      await expect(dialog1).toBeVisible();
      await expect(dialog1.getByText('Laura D.')).toBeVisible();
      await expect(dialog1.getByText('Almuerzo campus')).toBeVisible();
      await expect(dialog1.getByLabel(/contraseña de tu cuenta/i)).toHaveCount(0);

      // Doble clic rápido sobre «Confirmar envío» aplica una sola transferencia.
      let transferCalls = 0;
      await pageA.route('**/api/v1/transfers', async (route) => {
        if (route.request().method() === 'POST') {
          transferCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        await route.continue();
      });

      await dialog1.getByRole('button', { name: /confirmar envío/i }).dblclick();
      await expect(pageA.getByRole('heading', { name: /transferencia enviada/i })).toBeVisible();
      expect(transferCalls).toBe(1);
      await pageA.unroute('**/api/v1/transfers');

      // Verificar saldos y movimientos en ambos contextos.
      await pageA.goto('/inicio');
      await expect(pageA.getByText(/^\$\s*285\.000$/).first()).toBeVisible();
      await expect(pageA.getByText('Transferencia a Laura D.')).toBeVisible();
      await expect(pageA.getByText('Almuerzo campus')).toBeVisible();
      await expect(pageA.getByText(/-\$\s*15\.000/)).toBeVisible();

      await pageB.goto('/inicio');
      await expect(pageB.getByText(/^\$\s*15\.000$/).first()).toBeVisible();
      await expect(pageB.getByText('Transferencia de Carlos G.')).toBeVisible();
      await expect(pageB.getByText('Almuerzo campus')).toBeVisible();
      await expect(pageB.getByText(/\+\$\s*15\.000/)).toBeVisible();

      // Envío alto ($210.000 > $200.000) exige contraseña de reautenticación.
      await pageA.goto('/enviar');
      await pageA.getByLabel(/correo institucional o alias/i).fill(emailB);
      await pageA.getByRole('button', { name: /buscar destinatario/i }).click();
      await expect(pageA.getByText('Laura D.')).toBeVisible();

      await pageA.getByLabel(/monto a enviar/i).fill('210000');
      await pageA.getByRole('button', { name: /^continuar$/i }).click();

      const dialog2 = pageA.getByRole('dialog');
      const pwdInput = dialog2.getByLabel(/contraseña de tu cuenta/i);
      await expect(pwdInput).toBeVisible();

      // Contraseña incorrecta rechaza sin mover dinero
      await pwdInput.fill('ClaveEquivocada#1');
      await dialog2.getByRole('button', { name: /confirmar envío/i }).click();
      await expect(dialog2.getByText(/la contraseña no es correcta/i)).toBeVisible();

      // Contraseña correcta completa el envío
      await pwdInput.fill('ClaveSegura#2026');
      await dialog2.getByRole('button', { name: /reintentar envío/i }).click();
      await expect(pageA.getByRole('heading', { name: /transferencia enviada/i })).toBeVisible();

      await pageB.reload();
      await expect(pageB.getByText(/^\$\s*225\.000$/).first()).toBeVisible();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
