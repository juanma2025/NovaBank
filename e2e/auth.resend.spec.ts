import { expect, test } from '@playwright/test';

import { uniqueStudentEmail } from './helpers/auth.js';
import { waitForNewCode } from './helpers/mailpit.js';

test.describe('Reenvío de código de verificación (spec 001 · US4 · T079)', () => {
  test('espera cuenta regresiva de 60 s, reenvía, invalida el código anterior y acepta el nuevo', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Espera real de cooldown 60 s validada una vez en escritorio',
    );
    test.setTimeout(120_000);

    const email = uniqueStudentEmail('reenvio');
    await page.goto('/registro');
    await page.getByLabel(/correo institucional/i).fill(email);
    await page.locator('.t-check').click();
    await page.getByRole('button', { name: /enviar código/i }).click();

    await expect(
      page.getByRole('heading', { name: /revisa tu correo institucional/i }),
    ).toBeVisible();
    const first = await waitForNewCode(page.request, email);

    // Mientras corre la cuenta regresiva el botón está deshabilitado
    const countdownBtn = page.getByRole('button', { name: /reenviar código en \d+ s/i });
    await expect(countdownBtn).toBeVisible();
    await expect(countdownBtn).toBeDisabled();

    // Al terminar los 60 s se habilita «Reenviar código»
    const resendBtn = page.getByRole('button', { name: /^reenviar código$/i });
    await expect(resendBtn).toBeEnabled({ timeout: 70_000 });
    await resendBtn.click();

    await expect(page.getByText(/enviamos un código nuevo/i)).toBeVisible();
    const second = await waitForNewCode(page.request, email, {
      excludeIds: new Set([first.id]),
    });

    // El código anterior dejó de servir
    await page.getByLabel(/dígito 1 de 6/i).fill(first.code);
    await expect(page.getByRole('alert')).toContainText(/el código no es válido/i);

    // El código nuevo avanza al paso 3
    await page.getByLabel(/dígito 1 de 6/i).fill(second.code);
    await expect(page.getByRole('heading', { name: /completa tu perfil/i })).toBeVisible();
  });
});
