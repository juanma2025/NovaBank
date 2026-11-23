/**
 * Spec 005 — Metas de ahorro (tasks.md T012, T019 y T022). Límites de prueba (vitest.config.ts):
 * $1.000 a $50.000 por aporte o retiro y $80.000 por día. Recargas: máximo $50.000 cada una.
 */
import {
  addYearsToIsoDate,
  bogotaToday,
  CloseGoalResultSchema,
  GoalListSchema,
  GoalSchema,
  MovementsPageSchema,
  SavingsMovementResultSchema,
  type Goal,
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

const GOALS = '/api/v1/savings/goals';
let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
});
afterAll(async () => {
  await t.close();
});

async function createGoal(user: TestUser, body: object = {}): Promise<Goal> {
  const res = await user.agent.post(GOALS, { name: 'Viaje', targetAmount: 600_000, ...body });
  expect(res.status).toBe(201);
  return GoalSchema.parse(res.body);
}

function deposit(user: TestUser, goalId: string, amount: number, key = newKey()) {
  return user.agent.post(`${GOALS}/${goalId}/deposits`, { amount }, { [IDEMPOTENCY]: key });
}

function withdraw(user: TestUser, goalId: string, amount: number, key = newKey()) {
  return user.agent.post(`${GOALS}/${goalId}/withdrawals`, { amount }, { [IDEMPOTENCY]: key });
}

function close(user: TestUser, goalId: string, key = newKey()) {
  return user.agent.post(`${GOALS}/${goalId}/close`, undefined, { [IDEMPOTENCY]: key });
}

async function goalsOf(user: TestUser) {
  return GoalListSchema.parse((await user.agent.get(GOALS)).body);
}

/** Saldo disponible + saldos de todas las metas del estudiante (SC-002). */
async function totalOf(user: TestUser): Promise<number> {
  const goals = await goalsOf(user);
  return (await balanceOf(user)) + goals.items.reduce((sum, g) => sum + g.balance, 0);
}

/** Estudiante con saldo disponible (el reloj avanza para que el orden del historial sea estable). */
async function saver(prefix: string, balance = 100_000): Promise<TestUser> {
  const user = await createUserWithSession(t, prefix);
  if (balance > 0) await fund(user, balance);
  t.clock.advanceSeconds(1);
  return user;
}

describe('US1 · crear metas (FR-001, FR-002)', () => {
  it('crea una meta activa con saldo 0, nombre recortado y fecha', async () => {
    const user = await saver('crea', 0);
    const date = addYearsToIsoDate(bogotaToday(t.clock.now()), 1);
    const goal = await createGoal(user, { name: '  Viaje a Santa Marta ', targetDate: date });
    expect(goal).toMatchObject({
      name: 'Viaje a Santa Marta',
      targetAmount: 600_000,
      targetDate: date,
      balance: 0,
      completed: false,
      status: 'active',
      closedAt: null,
    });
    const event = await t.prisma.auditEvent.findFirstOrThrow({
      where: { userId: user.userId, type: 'GOAL_CREATED' },
    });
    expect(event.metadata).toEqual({ goalId: goal.id });
  });

  it('fecha pasada o a más de 10 años: 400', async () => {
    const user = await saver('fechas', 0);
    const today = bogotaToday(t.clock.now());
    const past = await user.agent.post(GOALS, {
      name: 'X',
      targetAmount: 1000,
      targetDate: '2020-01-01',
    });
    expect(past.status).toBe(400);
    expect(past.body.error.details.fields.targetDate).toBe('past');
    const far = await user.agent.post(GOALS, {
      name: 'X',
      targetAmount: 1000,
      targetDate: addYearsToIsoDate(today, 11),
    });
    expect(far.body.error.details.fields.targetDate).toBe('too_far');
    // Hoy sí se permite.
    expect(
      (await user.agent.post(GOALS, { name: 'X', targetAmount: 1000, targetDate: today })).status,
    ).toBe(201);
  });

  it('5 activas como máximo, también con 6 creaciones simultáneas', async () => {
    const user = await saver('cinco', 0);
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        user.agent.post(GOALS, { name: `Meta ${i}`, targetAmount: 1000 }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    expect(results.filter((r) => r.body?.error?.code === 'GOAL_LIMIT_REACHED')).toHaveLength(1);
  });
});

describe('US1 · aportar (FR-003, FR-004, FR-007–FR-011, FR-014)', () => {
  it('mueve el dinero a la meta y cada historial muestra su lado', async () => {
    const user = await saver('aporta');
    const goal = await createGoal(user, { name: 'Viaje' });
    const res = await deposit(user, goal.id, 50_000);
    expect(res.status).toBe(201);
    const body = SavingsMovementResultSchema.parse(res.body);
    expect(body.availableBalance).toBe(50_000);
    expect(body.goal).toMatchObject({ balance: 50_000, completed: false });
    expect(body.movement).toMatchObject({
      type: 'savings_deposit',
      amount: -50_000,
      description: 'Aporte a Viaje',
      status: 'completed',
    });

    expect(await balanceOf(user)).toBe(50_000);
    const home = (await user.agent.get('/api/v1/accounts/me')).body;
    expect(home.recentMovements[0]).toMatchObject({ type: 'savings_deposit', amount: -50_000 });
    const history = MovementsPageSchema.parse(
      (await user.agent.get(`${GOALS}/${goal.id}/movements`)).body,
    );
    expect(history.items).toEqual([
      expect.objectContaining({
        type: 'savings_deposit',
        amount: 50_000,
        description: 'Aporte desde tu cuenta',
        transactionId: body.movement.transactionId,
      }),
    ]);
    const list = await goalsOf(user);
    expect(list.totalSaved).toBe(50_000);
    expect(
      await t.prisma.auditEvent.count({ where: { userId: user.userId, type: 'SAVINGS_DEPOSIT' } }),
    ).toBe(1);
  });

  it('por encima del objetivo: se acepta y la meta queda cumplida', async () => {
    const user = await saver('cumplida');
    const goal = await createGoal(user, { targetAmount: 1000 });
    const res = await deposit(user, goal.id, 2000);
    expect(res.status).toBe(201);
    expect(res.body.goal).toMatchObject({ balance: 2000, completed: true });
  });

  it('más que el disponible: INSUFFICIENT_FUNDS con el disponible', async () => {
    const user = await saver('sin-saldo', 10_000);
    const goal = await createGoal(user);
    const res = await deposit(user, goal.id, 10_001);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      details: { availableBalance: 10_000 },
    });
  });

  it('fuera de rango: 422 con el rango permitido; sin clave: 400', async () => {
    const user = await saver('rango');
    const goal = await createGoal(user);
    for (const amount of [999, 50_001]) {
      const res = await deposit(user, goal.id, amount);
      expect(res.body.error).toMatchObject({
        code: 'SAVINGS_AMOUNT_OUT_OF_RANGE',
        details: { minAmount: 1000, maxAmount: 50_000 },
      });
    }
    expect((await user.agent.post(`${GOALS}/${goal.id}/deposits`, { amount: 1000 })).status).toBe(
      400,
    );
  });

  it('tope diario con reinicio en el día de Bogotá', async () => {
    const user = await saver('tope');
    const goal = await createGoal(user);
    expect((await deposit(user, goal.id, 50_000)).status).toBe(201);
    expect((await deposit(user, goal.id, 30_000)).status).toBe(201);
    const over = await deposit(user, goal.id, 1000);
    expect(over.body.error).toMatchObject({
      code: 'SAVINGS_DAILY_LIMIT',
      details: { remainingToday: 0 },
    });
    expect((await user.agent.get('/api/v1/savings/limits')).body).toEqual({
      minAmount: 1000,
      maxAmount: 50_000,
      dailyLimit: 80_000,
      remainingToday: 0,
    });
    t.clock.advanceMinutes(24 * 60);
    await renewSession(t, user);
    expect((await deposit(user, goal.id, 1000)).status).toBe(201);
  });

  it('idempotencia: misma respuesta, otro cuerpo → 409 y doble clic simultáneo', async () => {
    const user = await saver('idem');
    const goal = await createGoal(user);
    const key = newKey();
    const first = await deposit(user, goal.id, 4000, key);
    const again = await deposit(user, goal.id, 4000, key);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect((await deposit(user, goal.id, 4001, key)).status).toBe(409);

    const double = newKey();
    const [a, b] = await Promise.all([
      deposit(user, goal.id, 3000, double),
      deposit(user, goal.id, 3000, double),
    ]);
    expect(a.body).toEqual(b.body);
    expect(await balanceOf(user)).toBe(100_000 - 7000);
  });

  it('aportes simultáneos que superan el disponible: solo se aplican los que caben', async () => {
    const user = await saver('sobregiro', 10_000);
    const goal = await createGoal(user);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => deposit(user, goal.id, 3000)),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.body?.error?.code === 'INSUFFICIENT_FUNDS')).toHaveLength(2);
    expect(await balanceOf(user)).toBe(1000);
    expect((await goalsOf(user)).items[0]?.balance).toBe(9000);
  });

  it('el dinero de la meta no se puede transferir ni pagar con tarjeta (FR-008)', async () => {
    const user = await createCardholder(t, 'apartado');
    await fund(user, 50_000);
    const card = await issueCard(user);
    const secrets = await revealCard(user, card.id);
    const goal = await createGoal(user);
    expect((await deposit(user, goal.id, 50_000)).status).toBe(201);

    const other = await createUserWithSession(t, 'apartado-b');
    const preview = await user.agent.get(
      `/api/v1/transfers/recipient?q=${encodeURIComponent(other.email)}`,
    );
    const transfer = await user.agent.post(
      '/api/v1/transfers',
      { recipientId: preview.body.recipientId, amount: 1000 },
      { [IDEMPOTENCY]: newKey() },
    );
    expect(transfer.body.error).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      details: { availableBalance: 0 },
    });
    expect((await pay(user, paymentBody(secrets, 1000))).body.error.code).toBe(
      'INSUFFICIENT_FUNDS',
    );
    // Una subcuenta de meta tampoco sirve como destinatario de una transferencia.
    const subaccount = await t.prisma.savingsGoal.findUniqueOrThrow({ where: { id: goal.id } });
    const toSub = await other.agent.post(
      '/api/v1/transfers',
      { recipientId: subaccount.accountId, amount: 1000 },
      { [IDEMPOTENCY]: newKey() },
    );
    expect(toSub.body.error.code).toBe('RECIPIENT_NOT_FOUND');
  });

  it('las metas de otro estudiante o un id inválido: 404 (FR-015)', async () => {
    const owner = await saver('duena');
    const other = await saver('otra');
    const goal = await createGoal(owner);
    for (const id of [goal.id, 'no-es-uuid']) {
      expect((await deposit(other, id, 1000)).status).toBe(404);
      expect((await withdraw(other, id, 1000)).status).toBe(404);
      expect((await close(other, id)).status).toBe(404);
      expect((await other.agent.patch(`${GOALS}/${id}`, { name: 'X' })).status).toBe(404);
      expect((await other.agent.get(`${GOALS}/${id}/movements`)).status).toBe(404);
    }
    expect((await goalsOf(other)).items).toEqual([]);
  });
});

describe('US2 · retirar (FR-007, FR-009, FR-010)', () => {
  it('devuelve el dinero al disponible y cada historial muestra su lado', async () => {
    const user = await saver('retira');
    const goal = await createGoal(user, { name: 'Viaje' });
    await deposit(user, goal.id, 30_000);
    t.clock.advanceSeconds(1);
    const res = await withdraw(user, goal.id, 20_000);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ availableBalance: 90_000, goal: { balance: 10_000 } });
    expect(res.body.movement).toMatchObject({
      type: 'savings_withdrawal',
      amount: 20_000,
      description: 'Retiro de Viaje',
    });
    const history = MovementsPageSchema.parse(
      (await user.agent.get(`${GOALS}/${goal.id}/movements`)).body,
    );
    expect(history.items[0]).toMatchObject({ amount: -20_000, description: 'Retiro a tu cuenta' });
    expect(
      await t.prisma.auditEvent.count({
        where: { userId: user.userId, type: 'SAVINGS_WITHDRAWAL' },
      }),
    ).toBe(1);
  });

  it('más que el saldo de la meta: INSUFFICIENT_FUNDS con el saldo de la meta', async () => {
    const user = await saver('retira-mas');
    const goal = await createGoal(user);
    await deposit(user, goal.id, 5000);
    const res = await withdraw(user, goal.id, 5001);
    expect(res.body.error).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      details: { availableBalance: 5000 },
    });
  });

  it('los retiros cuentan para el mismo tope diario que los aportes', async () => {
    const user = await saver('tope-retiro');
    const goal = await createGoal(user);
    await deposit(user, goal.id, 50_000);
    expect((await withdraw(user, goal.id, 30_000)).status).toBe(201);
    expect((await deposit(user, goal.id, 1000)).body.error.code).toBe('SAVINGS_DAILY_LIMIT');
  });

  it('retiros simultáneos que superan la meta: solo los que caben', async () => {
    const user = await saver('retiros');
    const goal = await createGoal(user);
    await deposit(user, goal.id, 10_000);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => withdraw(user, goal.id, 3000)),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect((await goalsOf(user)).items[0]?.balance).toBe(1000);
  });

  it('aportes y retiros cruzados entre la cuenta y dos metas: sin deadlock y sin perder dinero', async () => {
    const user = await saver('cruzados');
    const a = await createGoal(user, { name: 'A' });
    const b = await createGoal(user, { name: 'B' });
    await deposit(user, a.id, 20_000);
    await deposit(user, b.id, 20_000);
    const before = await totalOf(user);
    const results = await Promise.all([
      deposit(user, a.id, 1000),
      withdraw(user, b.id, 1000),
      deposit(user, b.id, 1000),
      withdraw(user, a.id, 1000),
      deposit(user, a.id, 1000),
      withdraw(user, b.id, 1000),
    ]);
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(201));
    expect(await totalOf(user)).toBe(before);
  });
});

describe('US3 · editar (FR-005)', () => {
  it('cambia nombre, objetivo y fecha, y la quita con null', async () => {
    const user = await saver('edita');
    const goal = await createGoal(user);
    await deposit(user, goal.id, 5000);
    const date = addYearsToIsoDate(bogotaToday(t.clock.now()), 2);
    const res = await user.agent.patch(`${GOALS}/${goal.id}`, {
      name: ' Moto ',
      targetAmount: 4000,
      targetDate: date,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Moto',
      targetAmount: 4000,
      targetDate: date,
      balance: 5000,
      completed: true,
    });
    expect(
      (await user.agent.patch(`${GOALS}/${goal.id}`, { targetDate: null })).body.targetDate,
    ).toBeNull();
  });

  it('fecha pasada o actualización vacía: 400', async () => {
    const user = await saver('edita-400', 0);
    const goal = await createGoal(user);
    expect(
      (await user.agent.patch(`${GOALS}/${goal.id}`, { targetDate: '2020-01-01' })).status,
    ).toBe(400);
    expect((await user.agent.patch(`${GOALS}/${goal.id}`, {})).status).toBe(400);
  });
});

describe('US3 · cerrar (FR-012, FR-013)', () => {
  it('con saldo: devuelve todo, queda cerrada y libera el cupo', async () => {
    const user = await saver('cierra');
    const goals: Goal[] = [];
    for (let i = 0; i < 5; i += 1) {
      goals.push(await createGoal(user, { name: `Meta ${i}` }));
      t.clock.advanceSeconds(1);
    }
    const goal = goals[0];
    if (!goal) throw new Error('sin metas');
    await deposit(user, goal.id, 30_000);
    const res = await close(user, goal.id);
    expect(res.status).toBe(200);
    const body = CloseGoalResultSchema.parse(res.body);
    expect(body.goal).toMatchObject({ status: 'closed', balance: 0 });
    expect(body.goal.closedAt).not.toBeNull();
    expect(body.movement).toMatchObject({
      type: 'savings_withdrawal',
      amount: 30_000,
      description: 'Cierre de Meta 0',
    });
    expect(body.availableBalance).toBe(100_000);
    expect(await balanceOf(user)).toBe(100_000);

    const event = await t.prisma.auditEvent.findFirstOrThrow({
      where: { userId: user.userId, type: 'GOAL_CLOSED' },
    });
    expect(event.metadata).toEqual({
      goalId: goal.id,
      returnedAmount: 30_000,
      transactionId: body.movement?.transactionId,
    });
    // Liberó el cupo y queda al final de la lista, con su historial.
    expect((await user.agent.post(GOALS, { name: 'Nueva', targetAmount: 1000 })).status).toBe(201);
    const list = await goalsOf(user);
    expect(list.items.at(-1)).toMatchObject({ id: goal.id, status: 'closed' });
    const history = MovementsPageSchema.parse(
      (await user.agent.get(`${GOALS}/${goal.id}/movements`)).body,
    );
    expect(history.items).toHaveLength(2);
  });

  it('sin saldo: movement null', async () => {
    const user = await saver('cierra-vacia', 0);
    const goal = await createGoal(user);
    const res = await close(user, goal.id);
    expect(res.status).toBe(200);
    expect(res.body.movement).toBeNull();
    expect(res.body.availableBalance).toBe(0);
  });

  it('la devolución supera el máximo por movimiento y no consume el tope diario', async () => {
    const user = await saver('exenta');
    const goal = await createGoal(user);
    await deposit(user, goal.id, 50_000);
    await deposit(user, goal.id, 20_000);
    const res = await close(user, goal.id);
    expect(res.status).toBe(200);
    expect(res.body.movement.amount).toBe(70_000);
    // Siguen quedando $10.000 de los $80.000 del día.
    expect((await user.agent.get('/api/v1/savings/limits')).body.remainingToday).toBe(10_000);
  });

  it('una meta cerrada no admite aportes, retiros, cambios ni otro cierre (409)', async () => {
    const user = await saver('cerrada');
    const goal = await createGoal(user);
    await close(user, goal.id);
    for (const res of [
      await deposit(user, goal.id, 1000),
      await withdraw(user, goal.id, 1000),
      await user.agent.patch(`${GOALS}/${goal.id}`, { name: 'Otra' }),
      await close(user, goal.id),
    ]) {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('GOAL_CLOSED');
    }
  });

  it('cerrar dos veces con la misma clave devuelve la respuesta original', async () => {
    const user = await saver('cierra-idem');
    const goal = await createGoal(user);
    await deposit(user, goal.id, 5000);
    const key = newKey();
    const first = await close(user, goal.id, key);
    const again = await close(user, goal.id, key);
    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
    expect(await balanceOf(user)).toBe(100_000);
  });

  it('cerrar con aportes en curso: ningún dinero se pierde', async () => {
    const user = await saver('cierra-en-curso');
    const goal = await createGoal(user);
    await deposit(user, goal.id, 10_000);
    const before = await totalOf(user);
    const deposits = Array.from({ length: 5 }, () => deposit(user, goal.id, 1000));
    const [results, closed] = await Promise.all([Promise.all(deposits), close(user, goal.id)]);
    expect(closed.status).toBe(200);
    expect(
      results.filter((r) => r.status !== 201).every((r) => r.body.error.code === 'GOAL_CLOSED'),
    ).toBe(true);
    expect(await totalOf(user)).toBe(before);
    expect(await balanceOf(user)).toBe(before);
  });
});

describe('garantías de la base e invariantes (SC-002, SC-003)', () => {
  it('la base impide modificar una meta cerrada, borrar metas y un saldo de meta negativo', async () => {
    const user = await saver('base');
    const goal = await createGoal(user);
    const row = await t.prisma.savingsGoal.findUniqueOrThrow({ where: { id: goal.id } });
    await expect(
      t.prisma.account.update({ where: { id: row.accountId }, data: { balance: -1n } }),
    ).rejects.toThrow();
    await expect(t.prisma.savingsGoal.delete({ where: { id: goal.id } })).rejects.toThrow();
    await close(user, goal.id);
    await expect(
      t.prisma.savingsGoal.update({ where: { id: goal.id }, data: { name: 'Otra' } }),
    ).rejects.toThrow(/cerrada no puede cambiar/);
  });

  it('la suma del libro es 0 y cada saldo (principal y metas) coincide con sus asientos', async () => {
    const total = await t.prisma.$queryRaw<
      { s: bigint }[]
    >`SELECT COALESCE(SUM(amount), 0) AS s FROM ledger_entries`;
    expect(Number(total[0]?.s)).toBe(0);
    const mismatched = await t.prisma.$queryRaw<{ id: string }[]>`
      SELECT a.id FROM accounts a
      WHERE a.kind IN ('student', 'savings_goal')
        AND a.balance <> (SELECT COALESCE(SUM(e.amount), 0) FROM ledger_entries e WHERE e.account_id = a.id)`;
    expect(mismatched).toEqual([]);
  });

  it('sin sesión: 401', async () => {
    expect((await request(t.app).get(GOALS)).status).toBe(401);
    expect((await request(t.app).get('/api/v1/savings/limits')).status).toBe(401);
  });
});
