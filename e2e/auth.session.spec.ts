import { expect, test } from '@playwright/test';

import { assertNoHorizontalOverflow, ensureVerifiedStudent } from './helpers/auth.js';

const SESSION_EMAIL = 'sesion-e2e@nova-test.edu.co';
const PASSWORD = 'ClaveSegura#2026';

test.describe('Inicio, cierre de sesión, bloqueo e inactividad (spec 001 · US2 · T068)', () => {
  test('protege /inicio con redirect, hace login/logout y bloquea por origen tras 5 fallos', async ({
    browser,
    contextOptions,
  }, testInfo) => {
    // Sembrar la cuenta fija una vez en escritorio sin consumir logins extra en móvil
    if (testInfo.project.name === 'chromium') {
      const seedCtx = await browser.newContext(contextOptions);
      const seedPage = await seedCtx.newPage();
      await ensureVerifiedStudent(seedPage, { email: SESSION_EMAIL, fullName: 'Mateo Sesión' });
      await seedCtx.close();
    }

    // 1. /inicio sin sesión redirige a /ingresar?redirect=%2Finicio y al entrar vuelve a /inicio
    const ctxA = await browser.newContext(contextOptions);
    const pageA = await ctxA.newPage();
    try {
      await pageA.goto('/inicio');
      await expect(pageA).toHaveURL(/\/ingresar\?redirect=%2Finicio/);
      await assertNoHorizontalOverflow(pageA, '/ingresar');

      await pageA.getByLabel(/correo institucional/i).fill(SESSION_EMAIL);
      await pageA.getByLabel(/^contraseña$/i).fill(PASSWORD);
      await pageA.getByRole('button', { name: /^ingresar$/i }).click();

      await expect(pageA).toHaveURL(/\/inicio$/);
      await expect(pageA.getByRole('heading', { name: /hola, mateo/i })).toBeVisible();

      // 2. Cerrar sesión devuelve a /ingresar y /inicio vuelve a exigir sesión
      await pageA.getByRole('button', { name: /cerrar sesión/i }).click();
      await expect(pageA).toHaveURL(/\/ingresar/);
      await pageA.goto('/inicio');
      await expect(pageA).toHaveURL(/\/ingresar\?redirect=%2Finicio/);

      // 3. 5 fallos desde contexto A bloquean ese origen, mientras contexto B entra normal
      if (testInfo.project.name === 'chromium') {
        await pageA.goto('/ingresar');
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await pageA.getByLabel(/correo institucional/i).fill(SESSION_EMAIL);
          await pageA.getByLabel(/^contraseña$/i).fill('ClaveEquivocada#99');
          const loginResp = pageA.waitForResponse(
            (res) => res.url().includes('/api/v1/auth/login') && res.request().method() === 'POST',
          );
          await pageA.getByRole('button', { name: /^ingresar$/i }).click();
          await loginResp;
        }
        await expect(pageA.getByText(/demasiados intentos fallidos/i)).toBeVisible();

        const ctxB = await browser.newContext(contextOptions);
        const pageB = await ctxB.newPage();
        try {
          await pageB.goto('/ingresar');
          await pageB.getByLabel(/correo institucional/i).fill(SESSION_EMAIL);
          await pageB.getByLabel(/^contraseña$/i).fill(PASSWORD);
          await pageB.getByRole('button', { name: /^ingresar$/i }).click();
          await expect(pageB).toHaveURL(/\/inicio$/);
        } finally {
          await ctxB.close();
        }
      }
    } finally {
      await ctxA.close();
    }
  });

  test('aviso de inactividad sincronizado entre dos pestañas («Seguir conectado» y vencimiento con regreso)', async ({
    browser,
    contextOptions,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium',
      'Sincronización multipestaña e inactividad validada en escritorio (overrides 20 s / 8 s)',
    );
    test.setTimeout(90_000);

    const ctx = await browser.newContext(contextOptions);
    const tab1 = await ctx.newPage();
    const tab2 = await ctx.newPage();

    try {
      await ensureVerifiedStudent(tab1, { email: SESSION_EMAIL, fullName: 'Mateo Sesión' });
      await tab1.goto('/inicio');
      await tab2.goto('/inicio');
      await expect(tab1.getByRole('heading', { name: /hola, mateo/i })).toBeVisible();
      await expect(tab2.getByRole('heading', { name: /hola, mateo/i })).toBeVisible();

      // Con overrides (20 s inactividad, 8 s aviso), el modal aparece a los ~12 s
      const dialog1 = tab1.getByRole('dialog');
      const dialog2 = tab2.getByRole('dialog');
      await expect(dialog1).toBeVisible({ timeout: 22_000 });
      await expect(dialog2).toBeVisible({ timeout: 10_000 });

      // «Seguir conectado» en tab1 cierra el aviso en ambas pestañas
      await dialog1.getByRole('button', { name: /seguir conectado/i }).click();
      await expect(dialog1).toBeHidden();
      await expect(dialog2).toBeHidden();

      // Sin interacción adicional, el aviso reaparece y al vencer redirige con motivo y redirect
      await tab2.close();
      await expect(dialog1).toBeVisible({ timeout: 22_000 });
      await expect(tab1).toHaveURL(/\/ingresar\?motivo=inactividad&redirect=%2Finicio/, {
        timeout: 15_000,
      });
      await expect(tab1.getByText(/sesión cerrada por inactividad/i)).toBeVisible();

      // Volver a ingresar regresa a la ruta donde estaba (/inicio)
      await tab1.getByLabel(/correo institucional/i).fill(SESSION_EMAIL);
      await tab1.getByLabel(/^contraseña$/i).fill(PASSWORD);
      await tab1.getByRole('button', { name: /^ingresar$/i }).click();
      await expect(tab1).toHaveURL(/\/inicio$/);
    } finally {
      await ctx.close();
    }
  });
});
