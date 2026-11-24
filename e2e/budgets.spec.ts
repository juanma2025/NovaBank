import type { CardSecrets } from '@nova/shared';
import { type APIRequestContext, expect, test } from '@playwright/test';

import {
  assertNoHorizontalOverflow,
  registerVerifiedStudent,
  seedTopup,
  uniqueStudentEmail,
} from './helpers/auth.js';

const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const DEFAULT_PASSWORD = 'ClaveSegura#2026';

interface MailpitSearchItem {
  ID: string;
  Subject?: string;
}

async function waitForBudgetEmail(
  request: APIRequestContext,
  email: string,
  expectedText: RegExp,
  timeoutMs = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await request.get(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    if (res.ok()) {
      const payload = (await res.json()) as { messages?: MailpitSearchItem[] };
      for (const msg of payload.messages ?? []) {
        if (expectedText.test(msg.Subject ?? '')) return;
        const full = await request.get(`${MAILPIT_URL}/api/v1/message/${msg.ID}`);
        if (full.ok()) {
          const body = (await full.json()) as { Text?: string; HTML?: string };
          if (expectedText.test(`${body.Text ?? ''} ${body.HTML ?? ''}`)) return;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`No llegó correo de alerta de presupuesto (${expectedText}) para ${email}`);
}

test.describe('Presupuesto mensual y alertas (spec 006 · T021 & T026)', () => {
  test('pone tope, paga al 85 % y al 110 % sin bloquear, ve toast, banner y correo en Mailpit', async ({
    page,
  }) => {
    const email = uniqueStudentEmail('presupuesto');
    await registerVerifiedStudent(page, {
      email,
      fullName: 'Valeria Presupuesto',
      password: DEFAULT_PASSWORD,
    });
    await seedTopup(page, 60_000);

    // Emitir tarjeta y revelar datos vía API para probar pagos reales en /tienda
    const issueRes = await page.request.post('/api/v1/cards', { data: { nickname: 'Compras U' } });
    expect(issueRes.status()).toBe(201);
    const issued = (await issueRes.json()) as { id: string };

    const revealRes = await page.request.post(`/api/v1/cards/${issued.id}/reveal`, {
      data: { password: DEFAULT_PASSWORD },
    });
    expect(revealRes.status()).toBe(200);
    const secret = (await revealRes.json()) as CardSecrets;
    const expiryMmYy = `${String(secret.expMonth).padStart(2, '0')}/${String(secret.expYear % 100).padStart(2, '0')}`;

    // 1. Poner tope de $ 20.000 en Comida en /presupuesto
    await page.goto('/presupuesto');
    await expect(page.getByRole('heading', { name: /presupuesto mensual/i })).toBeVisible();
    await assertNoHorizontalOverflow(page, '/presupuesto');

    await page.getByRole('button', { name: /poner tope en comida/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/tope mensual/i).fill('20000');
    await dialog.getByRole('button', { name: /guardar tope/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/\$\s*0 de \$\s*20\.000/)).toBeVisible();

    // 2. Pagar $ 17.000 en Cafetería Central (Comida → 85 % ≥ 80 %)
    await page.goto('/tienda');
    await expect(page.getByText(/puedes pagar entre/i)).toBeVisible();
    await page.getByLabel(/monto a pagar/i).fill('17000');
    await page.getByLabel(/número de tarjeta/i).fill(secret.number);
    await page.getByLabel(/vencimiento/i).fill(expiryMmYy);
    await page.getByLabel(/cvv/i).fill(secret.cvv);
    await page.getByRole('button', { name: /pagar ahora/i }).click();

    await expect(page.getByText(/pago aprobado/i)).toBeVisible();
    await expect(
      page.getByText(/te estás acercando a tu presupuesto de comida \(85 %\)/i),
    ).toBeVisible();

    // 3. Verificar correo de alerta del 80 % en Mailpit
    await waitForBudgetEmail(page.request, email, /comida/i);

    // 4. Verificar aviso en /inicio
    await page.goto('/inicio');
    await expect(page.getByText(/avisos de presupuesto este mes/i)).toBeVisible();
    await expect(page.getByText(/comida cerca del tope \(85 %\)/i)).toBeVisible();
    await assertNoHorizontalOverflow(page, '/inicio con alerta de presupuesto');

    // 5. Pagar $ 5.000 más (total $ 22.000 = 110 %) → el presupuesto NUNCA bloquea
    await page.goto('/tienda');
    await expect(page.getByText(/puedes pagar entre/i)).toBeVisible();
    await page.getByLabel(/monto a pagar/i).fill('5000');
    await page.getByLabel(/número de tarjeta/i).fill(secret.number);
    await page.getByLabel(/vencimiento/i).fill(expiryMmYy);
    await page.getByLabel(/cvv/i).fill(secret.cvv);
    await page.getByRole('button', { name: /pagar ahora/i }).click();

    await expect(page.getByText(/pago aprobado/i)).toBeVisible();
    await expect(page.getByText(/superaste tu presupuesto de comida/i)).toBeVisible();
  });
});
