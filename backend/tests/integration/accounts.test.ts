/** Spec 002 · US1 — Ver mi cuenta y mi saldo al entrar (tasks.md T022). */
import { AccountSummarySchema } from '@nova/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase } from '../helpers/test-db.js';
import { IDEMPOTENCY, createUserWithSession, newKey } from '../helpers/users.js';

const ME = '/api/v1/accounts/me';
let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
});
afterAll(async () => {
  await t.close();
});

describe('US1 · cuenta y saldo', () => {
  it('GET /accounts/me crea la cuenta con saldo 0 y sin movimientos (FR-001)', async () => {
    const { userId, agent } = await createUserWithSession(t);
    const res = await agent.get(ME);
    expect(res.status).toBe(200);
    const body = AccountSummarySchema.parse(res.body);
    expect(body).toMatchObject({ currency: 'COP', balance: 0, recentMovements: [] });
    expect(await t.prisma.account.count({ where: { userId } })).toBe(1);
  });

  it('dos solicitudes simultáneas crean una sola cuenta', async () => {
    const { userId, agent } = await createUserWithSession(t, 'simultaneo');
    const [a, b] = await Promise.all([agent.get(ME), agent.get(ME)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.id).toBe(b.body.id);
    expect(await t.prisma.account.count({ where: { userId } })).toBe(1);
  });

  it('un estudiante registrado antes de la 002 obtiene su cuenta al primer acceso', async () => {
    const { userId, agent } = await createUserWithSession(t, 'antiguo');
    expect(await t.prisma.account.count({ where: { userId } })).toBe(0);
    expect((await agent.get(ME)).body.balance).toBe(0);
  });

  it('muestra como máximo 5 movimientos recientes, del más nuevo al más antiguo', async () => {
    const { agent } = await createUserWithSession(t, 'recientes');
    for (const amount of [1000, 2000, 3000, 4000, 5000, 6000]) {
      await agent.post('/api/v1/topups', { amount }, { [IDEMPOTENCY]: newKey() });
      t.clock.advanceSeconds(1);
    }
    const res = await agent.get(ME);
    expect(res.body.balance).toBe(21_000);
    expect(res.body.recentMovements.map((m: { amount: number }) => m.amount)).toEqual([
      6000, 5000, 4000, 3000, 2000,
    ]);
    expect(res.body.recentMovements[0]).toMatchObject({
      type: 'topup',
      description: 'Recarga simulada',
      status: 'completed',
    });
  });

  it('cada estudiante ve solo su cuenta (FR-004)', async () => {
    const ana = await createUserWithSession(t, 'ana');
    const luis = await createUserWithSession(t, 'luis');
    await ana.agent.post('/api/v1/topups', { amount: 10_000 }, { [IDEMPOTENCY]: newKey() });
    const anaAccount = (await ana.agent.get(ME)).body;
    const luisAccount = (await luis.agent.get(ME)).body;
    expect(luisAccount.id).not.toBe(anaAccount.id);
    expect(luisAccount.balance).toBe(0);
    expect(luisAccount.recentMovements).toEqual([]);
  });

  it('sin sesión: 401', async () => {
    const res = await request(t.app).get(ME);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
