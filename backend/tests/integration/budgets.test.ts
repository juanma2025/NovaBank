/**
 * Spec 006 — Presupuesto mensual por categorías (tasks.md T012, T017 y T022).
 * Límites de prueba (vitest.config.ts): pagos con tarjeta y transferencias de $1.000 a $50.000;
 * transferencias por encima de $20.000 piden contraseña.
 */
import {
  addMonths,
  BudgetAlertListSchema,
  BudgetMonthSchema,
  BudgetTransfersPageSchema,
  bogotaMonth,
  type BudgetCategory,
  type CardSecrets,
} from '@nova/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  balanceOf,
  createCardholder,
  fund,
  issueCard,
  pay,
  paymentBody,
  revealCard,
} from '../helpers/cards.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase } from '../helpers/test-db.js';
import {
  IDEMPOTENCY,
  type TestUser,
  createUserWithSession,
  newKey,
  renewSession,
} from '../helpers/users.js';

const BUDGETS = '/api/v1/budgets';
let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
});
afterAll(async () => {
  await t.close();
});

interface Spender {
  user: TestUser;
  secrets: CardSecrets;
}

/** Estudiante con saldo, una tarjeta activa y sus datos completos. */
async function spender(prefix: string, balance = 100_000): Promise<Spender> {
  const user = await createCardholder(t, prefix);
  await fund(user, balance);
  const card = await issueCard(user);
  return { user, secrets: await revealCard(user, card.id) };
}

async function payAt(s: Spender, amount: number, merchant = 'cafeteria-central') {
  const res = await pay(s.user, paymentBody(s.secrets, amount, merchant));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res;
}

async function transfer(from: TestUser, to: TestUser, amount: number): Promise<string> {
  const preview = await from.agent.get(
    `/api/v1/transfers/recipient?q=${encodeURIComponent(to.email)}`,
  );
  const res = await from.agent.post(
    '/api/v1/transfers',
    { recipientId: preview.body.recipientId, amount },
    { [IDEMPOTENCY]: newKey() },
  );
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.movement.transactionId as string;
}

async function summary(user: TestUser, month?: string) {
  const res = await user.agent.get(month ? `${BUDGETS}?month=${month}` : BUDGETS);
  expect(res.status).toBe(200);
  return BudgetMonthSchema.parse(res.body);
}

function row(month: Awaited<ReturnType<typeof summary>>, category: BudgetCategory) {
  const found = month.categories.find((c) => c.category === category);
  if (!found) throw new Error(`sin ${category}`);
  return found;
}

function setLimit(user: TestUser, category: string, monthlyLimit: number) {
  return user.agent.put(`${BUDGETS}/limits/${category}`, { monthlyLimit });
}

async function alertsOf(user: TestUser) {
  return BudgetAlertListSchema.parse((await user.agent.get(`${BUDGETS}/alerts`)).body).items;
}

/** Correos de alerta de presupuesto entregados a la estudiante. */
async function budgetEmails(user: TestUser) {
  await t.deliverEmails();
  return t.mail.to(user.email).filter((m) => /presupuesto/.test(m.subject));
}

describe('US1 · resumen y topes (FR-001–FR-008)', () => {
  it('sin gastos ni topes: las 7 categorías sin tope y total 0', async () => {
    const user = await createUserWithSession(t, 'vacio');
    const month = await summary(user);
    expect(month.month).toBe(bogotaMonth(t.clock.now()));
    expect(month.totalSpent).toBe(0);
    expect(month.categories.map((c) => c.category)).toEqual([
      'food',
      'books',
      'transport',
      'stationery',
      'entertainment',
      'transfers',
      'other',
    ]);
    expect(month.categories.every((c) => c.status === 'none' && c.spent === 0)).toBe(true);
  });

  it('cada gasto suma en su categoría; lo que no es gasto no cuenta (FR-002–FR-004, SC-003)', async () => {
    const s = await spender('gastos');
    const other = await spender('gastos-otro');
    await payAt(s, 5000, 'cafeteria-central');
    await payAt(s, 2000, 'restaurante-la-u');
    await payAt(s, 3000, 'libreria-campus');
    await payAt(s, 1500, 'bus-universitario');
    await transfer(s.user, other.user, 4000);
    // No cuentan: transferencia recibida, aporte a una meta y un pago rechazado.
    await transfer(other.user, s.user, 1000);
    const goal = await s.user.agent.post('/api/v1/savings/goals', {
      name: 'Meta',
      targetAmount: 10_000,
    });
    await s.user.agent.post(
      `/api/v1/savings/goals/${goal.body.id}/deposits`,
      { amount: 2000 },
      { [IDEMPOTENCY]: newKey() },
    );
    const declined = await pay(s.user, { ...paymentBody(s.secrets, 9000), cvv: '000' });
    if (s.secrets.cvv !== '000') expect(declined.status).toBe(422);

    const month = await summary(s.user);
    expect(row(month, 'food').spent).toBe(7000);
    expect(row(month, 'books').spent).toBe(3000);
    expect(row(month, 'transport').spent).toBe(1500);
    expect(row(month, 'stationery').spent).toBe(0);
    expect(row(month, 'transfers').spent).toBe(4000);
    expect(month.totalSpent).toBe(15_500);
    // Lo recibido no cuenta para quien recibe; lo enviado sí para quien envía.
    expect(row(await summary(other.user), 'transfers').spent).toBe(1000);
  });

  it('poner, cambiar y quitar un tope; aplica desde este mes', async () => {
    const s = await spender('topes');
    await payAt(s, 5000);
    const set = await setLimit(s.user, 'food', 20_000);
    expect(set.status).toBe(200);
    expect(row(BudgetMonthSchema.parse(set.body), 'food')).toEqual({
      category: 'food',
      spent: 5000,
      limit: 20_000,
      percent: 25,
      status: 'ok',
    });
    const changed = BudgetMonthSchema.parse((await setLimit(s.user, 'food', 6000)).body);
    expect(row(changed, 'food')).toMatchObject({ percent: 83, status: 'warning' });
    const removed = await s.user.agent.delete(`${BUDGETS}/limits/food`);
    expect(row(BudgetMonthSchema.parse(removed.body), 'food')).toMatchObject({
      limit: null,
      percent: null,
      status: 'none',
    });
  });

  it('tope fuera de rango o categoría inválida: 400', async () => {
    const user = await createUserWithSession(t, 'topes-400');
    expect((await setLimit(user, 'food', 999)).status).toBe(400);
    expect((await setLimit(user, 'food', 50_000_001)).status).toBe(400);
    const invalid = await setLimit(user, 'rent', 10_000);
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.details.fields.category).toBe('invalid');
    expect((await user.agent.delete(`${BUDGETS}/limits/rent`)).status).toBe(400);
  });

  it('un gasto que supera el tope se realiza igual (FR-008)', async () => {
    const s = await spender('no-bloquea');
    await setLimit(s.user, 'food', 1000);
    await payAt(s, 5000);
    expect(await balanceOf(s.user)).toBe(95_000);
    expect(row(await summary(s.user), 'food')).toMatchObject({ percent: 500, status: 'exceeded' });
  });

  it('mes inválido, futuro o anterior a los 6 meses: 400; uno de los 6 anteriores: 200', async () => {
    const user = await createUserWithSession(t, 'meses');
    const current = bogotaMonth(t.clock.now());
    for (const month of ['2026-13', addMonths(current, 1), addMonths(current, -7)]) {
      expect((await user.agent.get(`${BUDGETS}?month=${month}`)).status, month).toBe(400);
    }
    expect((await summary(user, addMonths(current, -6))).month).toBe(addMonths(current, -6));
  });
});

describe('US2 · alertas (FR-009–FR-012)', () => {
  it('80 % y luego más del 100 %: una alerta y un correo por umbral, sin repetir', async () => {
    const s = await spender('alertas');
    await setLimit(s.user, 'food', 10_000);
    await payAt(s, 7000);
    expect(await alertsOf(s.user)).toEqual([]);

    await payAt(s, 1000);
    const [warning] = await alertsOf(s.user);
    expect(warning).toMatchObject({
      category: 'food',
      threshold: 80,
      spent: 8000,
      limit: 10_000,
      seen: false,
    });
    let emails = await budgetEmails(s.user);
    expect(emails.map((m) => m.subject)).toEqual(['Te estás acercando a tu presupuesto de Comida']);

    await payAt(s, 3000);
    expect((await alertsOf(s.user)).map((a) => a.threshold)).toEqual([100, 80]);
    emails = await budgetEmails(s.user);
    expect(emails.at(-1)?.subject).toBe('Superaste tu presupuesto de Comida');

    await payAt(s, 1000);
    expect(await alertsOf(s.user)).toHaveLength(2);
    expect(await budgetEmails(s.user)).toHaveLength(2);
  });

  it('un salto del 50 % al 120 % crea las dos; exactamente el tope solo la del 80 %', async () => {
    const jump = await spender('salto');
    await setLimit(jump.user, 'food', 10_000);
    await payAt(jump, 5000);
    await payAt(jump, 7000);
    expect((await alertsOf(jump.user)).map((a) => a.threshold).sort()).toEqual([100, 80]);

    const exact = await spender('exacto');
    await setLimit(exact.user, 'food', 10_000);
    await payAt(exact, 10_000);
    expect((await alertsOf(exact.user)).map((a) => a.threshold)).toEqual([80]);
  });

  it('bajar un tope por debajo de lo gastado genera alertas; subirlo no las repite', async () => {
    const s = await spender('bajar-tope');
    await payAt(s, 6000);
    await setLimit(s.user, 'food', 7000);
    expect((await alertsOf(s.user)).map((a) => a.threshold)).toEqual([80]);
    await setLimit(s.user, 'food', 50_000);
    expect(await alertsOf(s.user)).toHaveLength(1);
    await setLimit(s.user, 'food', 5000);
    expect((await alertsOf(s.user)).map((a) => a.threshold).sort()).toEqual([100, 80]);
  });

  it('las transferencias enviadas también alertan en «Transferencias»', async () => {
    const s = await spender('alerta-transfer');
    const other = await createUserWithSession(t, 'alerta-transfer-b');
    await setLimit(s.user, 'transfers', 5000);
    await transfer(s.user, other, 4500);
    expect(await alertsOf(s.user)).toEqual([
      expect.objectContaining({ category: 'transfers', threshold: 80 }),
    ]);
  });

  it('pagos simultáneos que cruzan los umbrales: una sola alerta y un solo correo por umbral', async () => {
    const s = await spender('carrera');
    await setLimit(s.user, 'food', 10_000);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => pay(s.user, paymentBody(s.secrets, 2500))),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect((await alertsOf(s.user)).map((a) => a.threshold).sort()).toEqual([100, 80]);
    expect(await budgetEmails(s.user)).toHaveLength(2);
  });

  it('regla de dominio 10: si la evaluación falla, el pago se realiza igual', async () => {
    const s = await spender('falla');
    await setLimit(s.user, 'food', 1000);
    const original = t.banking.budgets.evaluateCurrentMonth;
    t.banking.budgets.evaluateCurrentMonth = () => Promise.reject(new Error('falla simulada'));
    try {
      const res = await pay(s.user, paymentBody(s.secrets, 5000));
      expect(res.status).toBe(201);
    } finally {
      t.banking.budgets.evaluateCurrentMonth = original;
    }
    expect(await balanceOf(s.user)).toBe(95_000);
    expect(await alertsOf(s.user)).toEqual([]);
    // El siguiente gasto genera las alertas pendientes.
    await payAt(s, 1000);
    expect((await alertsOf(s.user)).map((a) => a.threshold).sort()).toEqual([100, 80]);
  });

  it('marcar vista: idempotente; una alerta ajena o un id inválido → 404', async () => {
    const s = await spender('vista');
    const other = await createUserWithSession(t, 'vista-otro');
    await setLimit(s.user, 'food', 1000);
    await payAt(s, 1000);
    const [alert] = await alertsOf(s.user);
    if (!alert) throw new Error('sin alerta');
    const seen = await s.user.agent.post(`${BUDGETS}/alerts/${alert.id}/seen`);
    expect(seen.status).toBe(200);
    expect(seen.body.seen).toBe(true);
    expect((await s.user.agent.post(`${BUDGETS}/alerts/${alert.id}/seen`)).body.seen).toBe(true);
    expect((await alertsOf(s.user))[0]?.seen).toBe(true);
    expect((await other.agent.post(`${BUDGETS}/alerts/${alert.id}/seen`)).status).toBe(404);
    expect((await other.agent.post(`${BUDGETS}/alerts/no-es-uuid/seen`)).status).toBe(404);
    expect(await alertsOf(other)).toEqual([]);
  });
});

describe('US3 · reclasificar transferencias (FR-013)', () => {
  it('lista las enviadas del mes, de la más nueva a la más vieja, por páginas', async () => {
    const s = await spender('lista');
    const other = await createUserWithSession(t, 'lista-b');
    for (const amount of [1000, 2000, 3000]) {
      await transfer(s.user, other, amount);
      t.clock.advanceSeconds(1);
    }
    const first = BudgetTransfersPageSchema.parse(
      (await s.user.agent.get(`${BUDGETS}/transfers?limit=2`)).body,
    );
    expect(first.items.map((i) => [i.amount, i.category])).toEqual([
      [3000, 'transfers'],
      [2000, 'transfers'],
    ]);
    expect(first.items[0]?.description).toMatch(/^Transferencia a /);
    const second = BudgetTransfersPageSchema.parse(
      (await s.user.agent.get(`${BUDGETS}/transfers?limit=2&cursor=${first.nextCursor ?? ''}`))
        .body,
    );
    expect(second.items.map((i) => i.amount)).toEqual([1000]);
    expect(second.nextCursor).toBeNull();
  });

  it('reclasificar mueve el monto entre categorías y puede generar alertas', async () => {
    const s = await spender('reclasifica');
    const other = await createUserWithSession(t, 'reclasifica-b');
    const id = await transfer(s.user, other, 4000);
    await setLimit(s.user, 'other', 3000);
    expect(await alertsOf(s.user)).toEqual([]);

    const res = await s.user.agent.put(`${BUDGETS}/transfers/${id}/category`, {
      category: 'other',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ transactionId: id, amount: 4000, category: 'other' });
    const month = await summary(s.user);
    expect(row(month, 'transfers').spent).toBe(0);
    expect(row(month, 'other')).toMatchObject({ spent: 4000, status: 'exceeded' });
    expect((await alertsOf(s.user)).map((a) => a.category)).toEqual(['other', 'other']);
  });

  it('una transferencia recibida, ajena, una recarga o un id inválido → 404; categoría inválida → 400', async () => {
    const s = await spender('reclasifica-404');
    const other = await spender('reclasifica-404-b');
    const sent = await transfer(s.user, other.user, 1000);
    const received = await transfer(other.user, s.user, 1000);
    const topup = await t.prisma.ledgerTransaction.findFirstOrThrow({
      where: { type: 'topup', account: { userId: s.user.userId } },
    });
    for (const id of [received, topup.id, 'no-es-uuid']) {
      const res = await s.user.agent.put(`${BUDGETS}/transfers/${id}/category`, {
        category: 'other',
      });
      expect(res.status, id).toBe(404);
    }
    expect(
      (await other.user.agent.put(`${BUDGETS}/transfers/${sent}/category`, { category: 'food' }))
        .status,
    ).toBe(404);
    expect(
      (await s.user.agent.put(`${BUDGETS}/transfers/${sent}/category`, { category: 'rent' }))
        .status,
    ).toBe(400);
  });

  it('sin sesión: 401', async () => {
    expect((await request(t.app).get(BUDGETS)).status).toBe(401);
    expect((await request(t.app).get(`${BUDGETS}/alerts`)).status).toBe(401);
  });
});

describe('US3 · historial con topes versionados (FR-005, FR-007)', () => {
  it('el mes anterior conserva sus gastos y el tope que tenía', async () => {
    const s = await spender('historial');
    const first = bogotaMonth(t.clock.now());
    await setLimit(s.user, 'food', 10_000);
    await payAt(s, 2000);

    t.clock.advanceMinutes(31 * 24 * 60);
    await renewSession(t, s.user);
    const second = bogotaMonth(t.clock.now());
    expect(second).toBe(addMonths(first, 1));
    // El tope se repite en el mes nuevo, con el gasto en cero.
    expect(row(await summary(s.user), 'food')).toMatchObject({ spent: 0, limit: 10_000 });

    await setLimit(s.user, 'food', 20_000);
    await payAt(s, 1000);
    expect(row(await summary(s.user), 'food')).toMatchObject({ spent: 1000, limit: 20_000 });
    expect(row(await summary(s.user, first), 'food')).toMatchObject({
      spent: 2000,
      limit: 10_000,
    });
    // Las alertas de la lista son solo del mes actual.
    expect(await alertsOf(s.user)).toEqual([]);
  });
});
