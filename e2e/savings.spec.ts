import { randomUUID } from 'node:crypto';

import { IDEMPOTENCY_HEADER } from '@nova/shared';
import { expect, test } from '@playwright/test';

import { assertNoHorizontalOverflow, ensureVerifiedStudent, getMyBalance } from './helpers/auth.js';

test.describe('Metas de ahorro (spec 005 · T018 & T026)', () => {
  test('recarga, crea meta, aporta, retira y cierra devolviendo el saldo al disponible', async ({
    page,
  }) => {
    await ensureVerifiedStudent(page, {
      email: 'metas-e2e@nova-test.edu.co',
      fullName: 'Camila Ahorro',
    });

    // Garantiza cupo libre de metas activas entre ejecuciones (chromium + móvil)
    const goalsRes = await page.request.get('/api/v1/savings/goals');
    expect(goalsRes.status()).toBe(200);
    const existing = (await goalsRes.json()) as { items: { id: string; status: string }[] };
    const activeGoals = existing.items.filter((g) => g.status === 'active');
    if (activeGoals.length >= 5 && activeGoals[0]) {
      await page.request.post(`/api/v1/savings/goals/${activeGoals[0].id}/close`, {
        headers: { [IDEMPOTENCY_HEADER]: randomUUID() },
      });
    }

    // Recarga real en /recargar para garantizar saldo disponible suficiente
    const initialBeforeTopup = await getMyBalance(page);
    await page.goto('/recargar');
    await expect(page.getByText(/puedes recargar entre/i)).toBeVisible();
    await page.getByLabel(/monto a recargar/i).fill('60000');
    await page.getByRole('button', { name: /^continuar$/i }).click();
    const confirmTopupDialog = page.getByRole('dialog');
    await confirmTopupDialog.getByRole('button', { name: /confirmar recarga/i }).click();
    await expect(page.getByText(/recarga aplicada/i)).toBeVisible();

    const availableBefore = await getMyBalance(page);
    expect(availableBefore).toBe(initialBeforeTopup + 60_000);

    // Crear meta nueva en /metas
    const goalName = `Santa Marta ${randomUUID().slice(0, 4)}`;
    await page.goto('/metas');
    await expect(page.getByRole('heading', { name: /metas de ahorro/i })).toBeVisible();
    await assertNoHorizontalOverflow(page, '/metas');

    await page.getByRole('button', { name: /nueva meta/i }).click();
    const createDialog = page.getByRole('dialog');
    await createDialog.getByLabel(/nombre de la meta/i).fill(goalName);
    await createDialog.getByLabel(/monto objetivo/i).fill('600000');
    await createDialog.getByRole('button', { name: /crear meta/i }).click();

    await expect(page.getByRole('heading', { level: 2, name: goalName })).toBeVisible();

    // Ir al detalle de la meta creada
    const goalHeading = page.getByRole('heading', { level: 2, name: goalName });
    const goalArticle = goalHeading
      .locator('xpath=ancestor::div[contains(@class, "nova-glass")]')
      .first();
    await goalArticle.getByRole('link', { name: /ver detalle/i }).click();
    await expect(page).toHaveURL(/\/metas\/.+/);
    await assertNoHorizontalOverflow(page, '/metas/:id');

    // Aportar $ 50.000 → progreso 8 % y ambos saldos actualizados
    await page.getByRole('button', { name: /^aportar$/i }).click();
    const depositDialog = page.getByRole('dialog');
    await depositDialog.getByLabel(/^monto$/i).fill('50000');
    await depositDialog.getByRole('button', { name: /confirmar aporte/i }).click();

    await expect(depositDialog).toBeHidden();
    await expect(page.getByText('8 %')).toBeVisible();
    await expect(page.getByText(/\$\s*50\.000 de \$\s*600\.000/)).toBeVisible();
    expect(await getMyBalance(page)).toBe(availableBefore - 50_000);

    // Retirar $ 20.000 → meta queda en $ 30.000 y disponible sube $ 20.000
    await page.getByRole('button', { name: /^retirar$/i }).click();
    const withdrawDialog = page.getByRole('dialog');
    await withdrawDialog.getByLabel(/^monto$/i).fill('20000');
    await withdrawDialog.getByRole('button', { name: /confirmar retiro/i }).click();

    await expect(withdrawDialog).toBeHidden();
    await expect(page.getByText(/\$\s*30\.000 de \$\s*600\.000/)).toBeVisible();
    expect(await getMyBalance(page)).toBe(availableBefore - 30_000);

    // Cerrar meta confirmando el retorno de $ 30.000 → disponible recupera el total
    await page.getByRole('button', { name: /cerrar meta/i }).click();
    const closeDialog = page.getByRole('dialog');
    await expect(closeDialog).toContainText(/\$\s*30\.000/);
    await closeDialog.getByRole('button', { name: /sí, cerrar meta/i }).click();

    await expect(closeDialog).toBeHidden();
    await expect(page.getByText(/esta meta está cerrada/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^aportar$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^retirar$/i })).toHaveCount(0);
    expect(await getMyBalance(page)).toBe(availableBefore);
  });
});
