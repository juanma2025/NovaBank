import { expect, test } from '@playwright/test';

import { assertNoHorizontalOverflow, uniqueStudentEmail } from './helpers/auth.js';
import {
  extractSixDigitCode,
  listMessagesFor,
  waitForNewCode,
  waitForNewMessage,
} from './helpers/mailpit.js';

test.describe('Registro con correo institucional (spec 001 · US1 · T058)', () => {
  test('flujo crítico: registro completo con recarga en paso 2, verificación por Mailpit y casos de dominio/correo existente', async ({
    page,
  }, testInfo) => {
    const isDesktop = testInfo.project.name === 'chromium';

    await page.goto('/registro');
    await expect(page.getByRole('heading', { name: /crea tu cuenta en nova/i })).toBeVisible();
    await assertNoHorizontalOverflow(page, '/registro');

    // 1. Dominio no permitido rechazado en campo sin enviar correo (verificado en escritorio)
    if (isDesktop) {
      const blockedEmail = 'persona.externa@gmail.com';
      await page.getByLabel(/correo institucional/i).fill(blockedEmail);
      await page.locator('.t-check').click();
      await page.getByRole('button', { name: /enviar código/i }).click();

      await expect(page.getByText(/solo se aceptan correos institucionales/i)).toBeVisible();
      expect(await listMessagesFor(page.request, blockedEmail)).toHaveLength(0);
    }

    // 2. Registro real con correo institucional permitido
    const email = uniqueStudentEmail('registro');
    await page.getByLabel(/correo institucional/i).fill(email);
    const consent = page.getByRole('checkbox');
    if (!(await consent.isChecked())) await page.locator('.t-check').click();
    await page.getByRole('button', { name: /enviar código/i }).click();

    await expect(
      page.getByRole('heading', { name: /revisa tu correo institucional/i }),
    ).toBeVisible();

    // Recargar en el paso 2 debe retomar el mismo paso (FR-009a)
    await page.reload();
    await expect(
      page.getByRole('heading', { name: /revisa tu correo institucional/i }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page, '/registro paso 2');

    const { id: firstMsgId, code } = await waitForNewCode(page.request, email);
    await page.getByLabel(/dígito 1 de 6/i).fill(code);

    // Paso 3: nombre completo y contraseña segura → entra a /inicio
    await expect(page.getByRole('heading', { name: /completa tu perfil/i })).toBeVisible();
    await page.getByLabel(/nombre completo/i).fill('Daniela Registro');
    await page.getByLabel(/crea una contraseña/i).fill('ClaveSegura#2026');
    await page.getByRole('button', { name: /crear cuenta/i }).click();

    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole('heading', { name: /hola, daniela/i })).toBeVisible();
    await assertNoHorizontalOverflow(page, '/inicio tras registro');

    // 3. Correo ya registrado: misma pantalla del código + correo de aviso sin código (FR-008)
    if (isDesktop) {
      await page.getByRole('button', { name: /cerrar sesión/i }).click();
      await expect(page).toHaveURL(/\/ingresar/);

      await page.goto('/registro');
      await page.getByLabel(/correo institucional/i).fill(email);
      await page.locator('.t-check').click();
      await page.getByRole('button', { name: /enviar código/i }).click();

      await expect(
        page.getByRole('heading', { name: /revisa tu correo institucional/i }),
      ).toBeVisible();

      const notice = await waitForNewMessage(page.request, email, {
        excludeIds: new Set([firstMsgId]),
      });
      expect(extractSixDigitCode(notice)).toBeNull();
      expect(`${notice.Subject} ${notice.Text}`).toMatch(/ya tienes|cuenta/i);
    }
  });
});
