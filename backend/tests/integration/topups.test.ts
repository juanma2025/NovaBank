/**
 * Spec 002 · US2 — Recarga simulada (tasks.md T028). Límites de prueba (vitest.config.ts):
 * mínimo $1.000, máximo $50.000 y tope diario $100.000.
 */
import { TopupResultSchema } from '@nova/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase } from '../helpers/test-db.js';
import { IDEMPOTENCY, createUserWithSession, newKey } from '../helpers/users.js';

const TOPUPS = '/api/v1/topups';
let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
});
afterAll(async () => {
  await t.close();
});

describe('US2 · recarga', () => {
  it('una recarga válida actualiza el saldo y crea el movimiento completado (FR-005, FR-008)', async () => {
    const { agent } = await createUserWithSession(t);
    const res = await agent.post(TOPUPS, { amount: 50_000 }, { [IDEMPOTENCY]: newKey() });
    expect(res.status).toBe(201);
    const body = TopupResultSchema.parse(res.body);
    expect(body.balance).toBe(50_000);
    expect(body.movement).toMatchObject({
      amount: 50_000,
      status: 'completed',
      description: 'Recarga simulada',
      type: 'topup',
      // Spec 003: las recargas no tienen nota.
      note: null,
    });
    expect((await agent.get('/api/v1/accounts/me')).body.balance).toBe(50_000);
  });

  it('fuera de rango: 422 TOPUP_AMOUNT_OUT_OF_RANGE con el rango permitido', async () => {
    const { agent } = await createUserWithSession(t, 'rango');
    for (const amount of [999, 50_001]) {
      const res = await agent.post(TOPUPS, { amount }, { [IDEMPOTENCY]: newKey() });
      expect(res.status, String(amount)).toBe(422);
      expect(res.body.error).toMatchObject({
        code: 'TOPUP_AMOUNT_OUT_OF_RANGE',
        details: { minAmount: 1000, maxAmount: 50_000 },
      });
    }
    expect((await agent.get('/api/v1/accounts/me')).body.balance).toBe(0);
  });

  it('tope diario: 422 con lo que queda, y se reinicia al día siguiente en Bogotá', async () => {
    const { userId, agent } = await createUserWithSession(t, 'tope');
    await agent.post(TOPUPS, { amount: 50_000 }, { [IDEMPOTENCY]: newKey() });
    await agent.post(TOPUPS, { amount: 40_000 }, { [IDEMPOTENCY]: newKey() });
    const over = await agent.post(TOPUPS, { amount: 20_000 }, { [IDEMPOTENCY]: newKey() });
    expect(over.status).toBe(422);
    expect(over.body.error).toMatchObject({
      code: 'TOPUP_DAILY_LIMIT',
      details: { remainingToday: 10_000 },
    });
    expect((await agent.get(`${TOPUPS}/limits`)).body).toEqual({
      minAmount: 1000,
      maxAmount: 50_000,
      dailyLimit: 100_000,
      remainingToday: 10_000,
    });
    t.clock.advanceMinutes(24 * 60);
    // La sesión venció por inactividad: se inicia una nueva al día siguiente.
    const fresh = await t.auth.sessions.create(t.prisma, userId);
    agent.cookies.set('nova_at', fresh.accessToken);
    const nextDay = await agent.post(TOPUPS, { amount: 20_000 }, { [IDEMPOTENCY]: newKey() });
    expect(nextDay.status).toBe(201);
  });

  it('sin Idempotency-Key: 400 VALIDATION_ERROR', async () => {
    const { agent } = await createUserWithSession(t, 'sinclave');
    const res = await agent.post(TOPUPS, { amount: 10_000 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields['Idempotency-Key']).toBe('required');
  });

  it('cuerpo inválido: 400', async () => {
    const { agent } = await createUserWithSession(t, 'cuerpo');
    for (const body of [{ amount: 10.5 }, { amount: '10000' }, { amount: 1000, extra: true }]) {
      const res = await agent.post(TOPUPS, body, { [IDEMPOTENCY]: newKey() });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe('US2 · idempotencia (regla de dominio 4, SC-004)', () => {
  it('la misma clave y el mismo cuerpo devuelven la respuesta original sin otra recarga', async () => {
    const { agent } = await createUserWithSession(t, 'repetida');
    const key = newKey();
    const first = await agent.post(TOPUPS, { amount: 10_000 }, { [IDEMPOTENCY]: key });
    const second = await agent.post(TOPUPS, { amount: 10_000 }, { [IDEMPOTENCY]: key });
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect((await agent.get('/api/v1/accounts/me')).body.balance).toBe(10_000);
  });

  it('la misma clave con otro cuerpo: 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const { agent } = await createUserWithSession(t, 'otrocuerpo');
    const key = newKey();
    await agent.post(TOPUPS, { amount: 10_000 }, { [IDEMPOTENCY]: key });
    const res = await agent.post(TOPUPS, { amount: 20_000 }, { [IDEMPOTENCY]: key });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('una recarga rechazada no guarda la clave: el reintento se vuelve a evaluar', async () => {
    const { agent } = await createUserWithSession(t, 'reintento');
    const key = newKey();
    expect((await agent.post(TOPUPS, { amount: 500 }, { [IDEMPOTENCY]: key })).status).toBe(422);
    expect((await agent.post(TOPUPS, { amount: 5000 }, { [IDEMPOTENCY]: key })).status).toBe(201);
  });

  it('la clave es por estudiante: otro estudiante puede usar el mismo valor', async () => {
    const a = await createUserWithSession(t, 'clave-a');
    const b = await createUserWithSession(t, 'clave-b');
    const key = newKey();
    expect((await a.agent.post(TOPUPS, { amount: 1000 }, { [IDEMPOTENCY]: key })).status).toBe(201);
    expect((await b.agent.post(TOPUPS, { amount: 2000 }, { [IDEMPOTENCY]: key })).status).toBe(201);
  });
});

describe('US2 · concurrencia (regla de dominio 3, SC-005)', () => {
  it('10 recargas simultáneas del mismo estudiante: saldo exacto y tope diario respetado', async () => {
    const { userId, agent } = await createUserWithSession(t, 'diez');
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        agent.post(TOPUPS, { amount: 15_000 }, { [IDEMPOTENCY]: newKey() }),
      ),
    );
    const ok = results.filter((r) => r.status === 201).length;
    const rejected = results.filter((r) => r.body?.error?.code === 'TOPUP_DAILY_LIMIT').length;
    expect(ok).toBe(6); // 6 × 15.000 = 90.000 ≤ 100.000; la séptima lo superaría
    expect(rejected).toBe(4);
    const account = await t.prisma.account.findUniqueOrThrow({ where: { userId } });
    expect(account.balance).toBe(90_000n);
  });

  it('dos solicitudes simultáneas con la misma clave aplican una sola recarga', async () => {
    const { agent } = await createUserWithSession(t, 'misma-clave');
    const key = newKey();
    const [a, b] = await Promise.all([
      agent.post(TOPUPS, { amount: 7000 }, { [IDEMPOTENCY]: key }),
      agent.post(TOPUPS, { amount: 7000 }, { [IDEMPOTENCY]: key }),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body).toEqual(b.body);
    expect((await agent.get('/api/v1/accounts/me')).body.balance).toBe(7000);
  });

  it('recargas simultáneas de estudiantes distintos se aplican todas', async () => {
    const users = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createUserWithSession(t, `paralelo${i}`)),
    );
    const results = await Promise.all(
      users.map((u) => u.agent.post(TOPUPS, { amount: 3000 }, { [IDEMPOTENCY]: newKey() })),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
  });
});

describe('US2 · atomicidad y auditoría', () => {
  it('si algo falla después de los asientos, no queda nada (FR-008)', async () => {
    const { userId, agent } = await createUserWithSession(t, 'atomica');
    await agent.get('/api/v1/accounts/me'); // la cuenta existe antes de la recarga
    const original = t.banking.idempotency.complete;
    t.banking.idempotency.complete = () => Promise.reject(new Error('falla simulada'));
    try {
      const res = await agent.post(TOPUPS, { amount: 9000 }, { [IDEMPOTENCY]: newKey() });
      expect(res.status).toBe(500);
    } finally {
      t.banking.idempotency.complete = original;
    }
    const account = await t.prisma.account.findUniqueOrThrow({ where: { userId } });
    expect(account.balance).toBe(0n);
    expect(await t.prisma.ledgerTransaction.count({ where: { accountId: account.id } })).toBe(0);
    expect(await t.prisma.idempotencyKey.count({ where: { userId } })).toBe(0);
  });

  it('cada recarga queda auditada como TOPUP_COMPLETED sin datos sensibles (FR-021)', async () => {
    const { userId, agent } = await createUserWithSession(t, 'audita');
    const res = await agent.post(TOPUPS, { amount: 4000 }, { [IDEMPOTENCY]: newKey() });
    const event = await t.prisma.auditEvent.findFirstOrThrow({
      where: { userId, type: 'TOPUP_COMPLETED' },
    });
    expect(event.metadata).toEqual({
      amount: 4000,
      transactionId: res.body.movement.transactionId,
    });
  });

  it('sin sesión: 401 en límites y en recargas', async () => {
    expect((await request(t.app).get(`${TOPUPS}/limits`)).status).toBe(401);
    expect(
      (await request(t.app).post(TOPUPS).set(IDEMPOTENCY, newKey()).send({ amount: 1000 })).status,
    ).toBe(401);
  });
});
