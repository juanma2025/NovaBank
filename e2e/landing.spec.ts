/**
 * Pruebas E2E de la experiencia pública multipágina y el selector de tema (spec 008, T006).
 * Corre en escritorio (`chromium`) y móvil (`movil-360`, 360×740) contra el servidor compilado.
 */
import { expect, test } from '@playwright/test';

import { HAS_FRONTEND } from './playwright.config.js';

const PUBLIC_ROUTES = ['/', '/caracteristicas', '/estudiantes'] as const;

test.describe('experiencia pública multipágina y tema (spec 008)', () => {
  test('navega desde / a /caracteristicas, /estudiantes y /registro con accesos únicos en el navbar', async ({
    page,
  }) => {
    test.skip(!HAS_FRONTEND, 'El frontend todavía no está compilado en esta rama');

    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1, name: /tu banca universitaria en pesos colombianos/i }),
    ).toBeVisible();
    await expect(page.getByText(/vista previa ilustrativa/i)).toBeVisible();

    // «Iniciar sesión» y «Crear cuenta» existen únicamente en el navbar (<header>).
    await expect(page.getByRole('link', { name: /^iniciar sesión$/i })).toHaveCount(1);
    await expect(page.getByRole('link', { name: /^crear cuenta$/i })).toHaveCount(1);

    const nav = page.getByRole('navigation', { name: /navegación principal/i });

    // Navegación a /caracteristicas
    await nav.getByRole('link', { name: /^características$/i }).click();
    await expect(page).toHaveURL(/\/caracteristicas$/);
    await expect(page.getByRole('heading', { level: 1, name: /qué hace nova/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /wallet cripto/i })).toBeVisible();
    await expect(page.getByText(/muy pronto/i)).toBeVisible();

    // Navegación a /estudiantes
    await nav.getByRole('link', { name: /^estudiantes$/i }).click();
    await expect(page).toHaveURL(/\/estudiantes$/);
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: /diseñada para estudiantes universitarios en colombia/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /leer política de datos/i })).toHaveAttribute(
      'href',
      '/privacidad',
    );

    // «Crear cuenta» lleva al registro
    await page.getByRole('link', { name: /^crear cuenta$/i }).click();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test('el selector de tema actualiza data-theme y persiste al recargar', async ({ page }) => {
    test.skip(!HAS_FRONTEND, 'El frontend todavía no está compilado en esta rama');

    await page.goto('/');

    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');
    const expectedTheme = initialTheme === 'dark' ? 'light' : 'dark';

    const toggle = page.getByRole('button', { name: /cambiar a modo (oscuro|claro)/i });
    await toggle.click();

    await expect(html).toHaveAttribute('data-theme', expectedTheme);
    await expect(toggle).toHaveAttribute('aria-pressed', String(expectedTheme === 'dark'));

    await page.reload();

    await expect(html).toHaveAttribute('data-theme', expectedTheme);
  });

  test('no presenta desbordamiento horizontal en ninguna ruta pública', async ({ page }) => {
    test.skip(!HAS_FRONTEND, 'El frontend todavía no está compilado en esta rama');

    for (const route of PUBLIC_ROUTES) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const metrics = await page.evaluate<{ scrollWidth: number; innerWidth: number }>(
        '({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth })',
      );
      expect(
        metrics.scrollWidth,
        `Desbordamiento horizontal detectado en ${route} (${metrics.scrollWidth}px > ${metrics.innerWidth}px)`,
      ).toBeLessThanOrEqual(metrics.innerWidth);
    }
  });
});
