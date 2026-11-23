/**
 * Spec 003 · US1 — Transferencias entre estudiantes (tasks.md T014). Límites de prueba
 * (vitest.config.ts): mínimo $1.000, contraseña por encima de $20.000, máximo $50.000 y tope diario
 * de envíos $60.000. Recargas: máximo $50.000 cada una y $100.000 por día.
 */
import { randomUUID } from 'node:crypto';

import { RecipientPreviewSchema, TransferLimitsSchema, TransferResultSchema } from '@nova/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase } from '../helpers/test-db.js';
import {
  IDEMPOTENCY,
  type TestUser,
  createUserWithSession,
  newKey,
  renewSession,
} from '../helpers/users.js';

const TRANSFERS = '/api/v1/transfers';
const PASSWORD = 'una clave bastante larga';
let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
});
afterAll(async () => {
  await t.close();
});

/** Recarga en partes de hasta $50.000 (máximo por recarga en las pruebas). */
async function fund(user: TestUser, amount: number): Promise<void> {
  for (let left = amount; left > 0; left -= 50_000) {
    const res = await user.agent.post(
      '/api/v1/topups',
      { amount: Math.min(left, 50_000) },
      { [IDEMPOTENCY]: newKey() },
    );
    expect(res.status).toBe(201);
  }
}

async function preview(user: TestUser, q: string) {
  return user.agent.get(`${TRANSFERS}/recipient?q=${encodeURIComponent(q)}`);
}

async function recipientIdOf(from: TestUser, to: TestUser): Promise<string> {
  const res = await preview(from, to.email);
  expect(res.status).toBe(200);
  return RecipientPreviewSchema.parse(res.body).recipientId;
}

function send(user: TestUser, body: object, key = newKey()) {
  return user.agent.post(TRANSFERS, body, { [IDEMPOTENCY]: key });
}

async function balanceOf(user: TestUser): Promise<number> {
  return (await user.agent.get('/api/v1/accounts/me')).body.balance as number;
}

/** A (Ana Pérez Gómez) y B (Juan Carlos Ríos), con A fondeada. */
async function pair(prefix: string, fundA = 50_000) {
  const a = await createUserWithSession(t, `${prefix}-a`, {
    fullName: 'Ana Pérez Gómez',
    password: PASSWORD,
  });
  const b = await createUserWithSession(t, `${prefix}-b`, { fullName: 'Juan Carlos Ríos' });
  if (fundA > 0) await fund(a, fundA);
  return { a, b, bId: await recipientIdOf(a, b) };
}

describe('US1 · vista previa del destinatario (FR-001–FR-004)', () => {
  it('por correo: nombre parcial, correo enmascarado y la cuenta del destinatario', async () => {
    const { a, b } = await pair('vista', 0);
    const res = await preview(a, `  ${b.email.toUpperCase()} `);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      recipientId: expect.any(String),
      displayName: 'Juan C. R.',
      maskedEmail: `${b.email.slice(0, 2)}***@nova-test.edu.co`,
    });
    // El destinatario aún no tenía cuenta: se creó (como en la spec 002).
    const account = await t.prisma.account.findUniqueOrThrow({ where: { userId: b.userId } });
    expect(res.body.recipientId).toBe(account.id);
  });

  it('por alias, con o sin @ y en mayúsculas', async () => {
    const { a, b, bId } = await pair('vista-alias', 0);
    expect((await b.agent.put('/api/v1/profile/me/alias', { alias: 'juan.rios' })).status).toBe(
      200,
    );
    for (const q of ['juan.rios', '@Juan.Rios']) {
      const res = await preview(a, q);
      expect(res.status, q).toBe(200);
      expect(res.body.recipientId).toBe(bId);
    }
  });

  it('desconocido: 404 RECIPIENT_NOT_FOUND; a sí mismo: 422 TRANSFER_TO_SELF', async () => {
    const { a } = await pair('vista-404', 0);
    for (const q of ['nadie@nova-test.edu.co', 'alias.libre', 'no es un alias!']) {
      const res = await preview(a, q);
      expect(res.status, q).toBe(404);
      expect(res.body.error.code).toBe('RECIPIENT_NOT_FOUND');
    }
    const self = await preview(a, a.email);
    expect(self.status).toBe(422);
    expect(self.body.error.code).toBe('TRANSFER_TO_SELF');
  });

  it('consulta muy corta o ausente: 400', async () => {
    const { a } = await pair('vista-400', 0);
    expect((await preview(a, '@a')).status).toBe(400);
    expect((await a.agent.get(`${TRANSFERS}/recipient`)).status).toBe(400);
  });
});

describe('US1 · enviar (FR-005–FR-014)', () => {
  it('una transferencia válida mueve el dinero y cada uno ve su movimiento', async () => {
    const { a, b, bId } = await pair('valida');
    const res = await send(a, { recipientId: bId, amount: 15_000, note: '  almuerzo ' });
    expect(res.status).toBe(201);
    const body = TransferResultSchema.parse(res.body);
    expect(body.balance).toBe(35_000);
    expect(body.movement).toMatchObject({
      type: 'transfer',
      amount: -15_000,
      description: 'Transferencia a Juan C. R.',
      note: 'almuerzo',
      status: 'completed',
    });

    expect(await balanceOf(a)).toBe(35_000);
    const bAccount = (await b.agent.get('/api/v1/accounts/me')).body;
    expect(bAccount.balance).toBe(15_000);
    expect(bAccount.recentMovements[0]).toMatchObject({
      type: 'transfer',
      amount: 15_000,
      description: 'Transferencia de Ana P. G.',
      note: 'almuerzo',
      transactionId: body.movement.transactionId,
    });
  });

  it('sin nota o con nota vacía: note null', async () => {
    const { a, bId } = await pair('sin-nota');
    const res = await send(a, { recipientId: bId, amount: 1000, note: '   ' });
    expect(res.status).toBe(201);
    expect(res.body.movement.note).toBeNull();
  });

  it('a sí mismo: 422 TRANSFER_TO_SELF', async () => {
    const { a } = await pair('self');
    const own = (await a.agent.get('/api/v1/accounts/me')).body.id as string;
    const res = await send(a, { recipientId: own, amount: 1000 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('TRANSFER_TO_SELF');
  });

  it('cuenta inexistente o del sistema: 404 RECIPIENT_NOT_FOUND', async () => {
    const { a } = await pair('no-cuenta');
    const systemId = await t.banking.accounts.getSystemTopupsAccountId(t.prisma);
    for (const recipientId of [randomUUID(), systemId]) {
      const res = await send(a, { recipientId, amount: 1000 });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RECIPIENT_NOT_FOUND');
    }
    expect(await balanceOf(a)).toBe(50_000);
  });

  it('fuera de rango: 422 con el rango permitido', async () => {
    const { a, bId } = await pair('rango');
    for (const amount of [999, 50_001]) {
      const res = await send(a, { recipientId: bId, amount, password: PASSWORD });
      expect(res.status, String(amount)).toBe(422);
      expect(res.body.error).toMatchObject({
        code: 'TRANSFER_AMOUNT_OUT_OF_RANGE',
        details: { minAmount: 1000, maxAmount: 50_000 },
      });
    }
  });

  it('saldo insuficiente: 422 con el disponible; enviar todo el saldo deja $0', async () => {
    const { a, bId } = await pair('saldo', 12_000);
    const over = await send(a, { recipientId: bId, amount: 12_001 });
    expect(over.status).toBe(422);
    expect(over.body.error).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      details: { availableBalance: 12_000 },
    });
    expect((await send(a, { recipientId: bId, amount: 12_000 })).status).toBe(201);
    expect(await balanceOf(a)).toBe(0);
  });

  it('tope diario de lo enviado (lo recibido no cuenta) y reinicio en el día de Bogotá', async () => {
    const { a, b, bId } = await pair('tope', 100_000);
    const aId = await recipientIdOf(b, a);
    await fund(b, 5000);
    expect((await send(b, { recipientId: aId, amount: 5000 })).status).toBe(201);
    for (const amount of [20_000, 20_000, 20_000]) {
      expect((await send(a, { recipientId: bId, amount })).status).toBe(201);
    }
    const over = await send(a, { recipientId: bId, amount: 1000 });
    expect(over.status).toBe(422);
    expect(over.body.error).toMatchObject({
      code: 'TRANSFER_DAILY_LIMIT',
      details: { remainingToday: 0 },
    });
    expect(TransferLimitsSchema.parse((await a.agent.get(`${TRANSFERS}/limits`)).body)).toEqual({
      minAmount: 1000,
      maxAmount: 50_000,
      dailyLimit: 60_000,
      reauthThreshold: 20_000,
      remainingToday: 0,
    });
    // Lo recibido no consume el tope de B.
    expect((await b.agent.get(`${TRANSFERS}/limits`)).body.remainingToday).toBe(55_000);

    t.clock.advanceMinutes(24 * 60);
    await renewSession(t, a);
    expect((await send(a, { recipientId: bId, amount: 1000 })).status).toBe(201);
  });

  it('sin Idempotency-Key o con un cuerpo inválido: 400', async () => {
    const { a, bId } = await pair('400');
    expect((await a.agent.post(TRANSFERS, { recipientId: bId, amount: 1000 })).status).toBe(400);
    for (const body of [
      { recipientId: bId, amount: 1000, extra: true },
      { recipientId: bId, amount: 10.5 },
      { recipientId: 'x', amount: 1000 },
      { recipientId: bId, amount: 1000, note: 'x'.repeat(141) },
    ]) {
      const res = await send(a, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe('US1 · reautenticación por encima del umbral (Principio III)', () => {
  it('sin contraseña: REAUTH_REQUIRED; incorrecta: REAUTH_FAILED sin mover dinero; correcta: 201', async () => {
    const { a, bId } = await pair('reauth');
    const required = await send(a, { recipientId: bId, amount: 20_001 });
    expect(required.status).toBe(422);
    expect(required.body.error).toMatchObject({
      code: 'REAUTH_REQUIRED',
      details: { reauthThreshold: 20_000 },
    });

    const failed = await send(a, { recipientId: bId, amount: 25_000, password: 'equivocada' });
    expect(failed.status).toBe(422);
    expect(failed.body.error.code).toBe('REAUTH_FAILED');
    expect(await balanceOf(a)).toBe(50_000);

    const ok = await send(a, { recipientId: bId, amount: 25_000, password: PASSWORD });
    expect(ok.status).toBe(201);
    expect(await balanceOf(a)).toBe(25_000);
    // Hasta el umbral no se pide contraseña.
    expect((await send(a, { recipientId: bId, amount: 20_000 })).status).toBe(201);
  });

  it('5 contraseñas incorrectas bloquean 15 minutos, incluso con la correcta', async () => {
    const { a, bId } = await pair('bloqueo');
    for (let i = 1; i <= 4; i += 1) {
      const res = await send(a, { recipientId: bId, amount: 30_000, password: `mala-${i}` });
      expect(res.body.error.code, `intento ${i}`).toBe('REAUTH_FAILED');
    }
    const locked = await send(a, { recipientId: bId, amount: 30_000, password: 'mala-5' });
    expect(locked.status).toBe(429);
    expect(locked.body.error).toMatchObject({
      code: 'REAUTH_LOCKED',
      details: { retryAfterSeconds: 900 },
    });
    expect(locked.headers['retry-after']).toBe('900');

    const stillLocked = await send(a, { recipientId: bId, amount: 30_000, password: PASSWORD });
    expect(stillLocked.body.error.code).toBe('REAUTH_LOCKED');
    // Los montos bajo el umbral no dependen de la contraseña.
    expect((await send(a, { recipientId: bId, amount: 1000 })).status).toBe(201);
    expect(await balanceOf(a)).toBe(49_000);

    t.clock.advanceMinutes(16);
    await renewSession(t, a);
    const after = await send(a, { recipientId: bId, amount: 30_000, password: PASSWORD });
    expect(after.status).toBe(201);
  });

  it('un acierto borra los fallos anteriores', async () => {
    const { a, bId } = await pair('acierto');
    for (let i = 1; i <= 4; i += 1) {
      await send(a, { recipientId: bId, amount: 21_000, password: `mala-${i}` });
    }
    expect((await send(a, { recipientId: bId, amount: 21_000, password: PASSWORD })).status).toBe(
      201,
    );
    const next = await send(a, { recipientId: bId, amount: 21_000, password: 'mala-otra' });
    expect(next.body.error.code).toBe('REAUTH_FAILED');
  });
});

describe('US1 · idempotencia (regla de dominio 4)', () => {
  it('la misma clave y el mismo cuerpo devuelven la respuesta original sin otro envío', async () => {
    const { a, bId } = await pair('idem');
    const key = newKey();
    const first = await send(a, { recipientId: bId, amount: 5000, note: 'cine' }, key);
    const again = await send(a, { recipientId: bId, amount: 5000, note: 'cine' }, key);
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(await balanceOf(a)).toBe(45_000);
  });

  it('la misma clave con otro cuerpo: 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const { a, bId } = await pair('idem-409');
    const key = newKey();
    await send(a, { recipientId: bId, amount: 5000 }, key);
    const other = await send(a, { recipientId: bId, amount: 6000 }, key);
    expect(other.status).toBe(409);
    expect(other.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('la contraseña no forma parte del hash', async () => {
    const { a, bId } = await pair('idem-pass');
    const key = newKey();
    const first = await send(a, { recipientId: bId, amount: 5000, password: 'cualquiera' }, key);
    const again = await send(a, { recipientId: bId, amount: 5000 }, key);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
  });

  it('un doble clic simultáneo con la misma clave aplica una sola transferencia', async () => {
    const { a, bId } = await pair('doble-clic');
    const key = newKey();
    const [x, y] = await Promise.all([
      send(a, { recipientId: bId, amount: 7000 }, key),
      send(a, { recipientId: bId, amount: 7000 }, key),
    ]);
    expect([x.status, y.status]).toEqual([201, 201]);
    expect(x.body).toEqual(y.body);
    expect(await balanceOf(a)).toBe(43_000);
  });
});

describe('US1 · concurrencia (regla de dominio 3, SC-005)', () => {
  it('transferencias cruzadas simultáneas A→B y B→A terminan sin deadlock', async () => {
    const { a, b, bId } = await pair('cruzadas');
    await fund(b, 50_000);
    const aId = await recipientIdOf(b, a);
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        i % 2 === 0
          ? send(a, { recipientId: bId, amount: 2000 })
          : send(b, { recipientId: aId, amount: 3000 }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(201));
    expect(await balanceOf(a)).toBe(50_000 - 6000 + 9000);
    expect(await balanceOf(b)).toBe(50_000 + 6000 - 9000);
  });

  it('envíos simultáneos que superan el saldo: solo se aplican los que caben', async () => {
    const { a, bId } = await pair('sobregiro', 10_000);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => send(a, { recipientId: bId, amount: 3000 })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    const rejected = results.filter((r) => r.status !== 201);
    expect(rejected.map((r) => r.body.error.code)).toEqual([
      'INSUFFICIENT_FUNDS',
      'INSUFFICIENT_FUNDS',
    ]);
    expect(await balanceOf(a)).toBe(1000);
  });
});

describe('US1 · destinatario fijado, auditoría e invariantes', () => {
  it('el dinero llega a quien se mostró aunque el alias cambie de dueño (FR-005)', async () => {
    const { a, b } = await pair('fijo');
    await b.agent.put('/api/v1/profile/me/alias', { alias: 'alias.movil' });
    const shown = RecipientPreviewSchema.parse((await preview(a, '@alias.movil')).body);
    await b.agent.delete('/api/v1/profile/me/alias');
    const c = await createUserWithSession(t, 'fijo-c', { fullName: 'Carla Díaz' });
    expect((await c.agent.put('/api/v1/profile/me/alias', { alias: 'alias.movil' })).status).toBe(
      200,
    );

    expect((await send(a, { recipientId: shown.recipientId, amount: 4000 })).status).toBe(201);
    expect(await balanceOf(b)).toBe(4000);
    expect(await balanceOf(c)).toBe(0);
  });

  it('queda auditada como TRANSFER_COMPLETED sin datos sensibles', async () => {
    const { a, bId } = await pair('audita');
    const res = await send(a, { recipientId: bId, amount: 2500, note: 'secreto' });
    const event = await t.prisma.auditEvent.findFirstOrThrow({
      where: { userId: a.userId, type: 'TRANSFER_COMPLETED' },
    });
    expect(event.metadata).toEqual({
      amount: 2500,
      transactionId: res.body.movement.transactionId,
      counterpartyAccountId: bId,
    });
  });

  it('la operación guarda la contraparte y la nota, con dos asientos que suman cero', async () => {
    const { a, bId } = await pair('libro');
    const res = await send(a, { recipientId: bId, amount: 8000, note: 'libros' });
    const op = await t.prisma.ledgerTransaction.findUniqueOrThrow({
      where: { id: res.body.movement.transactionId },
      include: { entries: true },
    });
    expect(op).toMatchObject({ type: 'transfer', counterpartyAccountId: bId, note: 'libros' });
    expect(op.entries.map((e) => [e.amount, e.description]).sort()).toEqual(
      [
        [-8000n, 'Transferencia a Juan C. R.'],
        [8000n, 'Transferencia de Ana P. G.'],
      ].sort(),
    );
  });

  it('la suma del libro es 0 y cada saldo coincide con sus asientos (SC-003)', async () => {
    const total = await t.prisma.$queryRaw<
      { s: bigint }[]
    >`SELECT COALESCE(SUM(amount), 0) AS s FROM ledger_entries`;
    expect(Number(total[0]?.s)).toBe(0);
    const mismatched = await t.prisma.$queryRaw<{ id: string }[]>`
      SELECT a.id FROM accounts a
      WHERE a.kind = 'student'
        AND a.balance <> (SELECT COALESCE(SUM(e.amount), 0) FROM ledger_entries e WHERE e.account_id = a.id)`;
    expect(mismatched).toEqual([]);
  });

  it('sin sesión: 401', async () => {
    expect((await request(t.app).get(`${TRANSFERS}/limits`)).status).toBe(401);
    expect((await request(t.app).get(`${TRANSFERS}/recipient?q=abc`)).status).toBe(401);
    expect(
      (
        await request(t.app)
          .post(TRANSFERS)
          .set(IDEMPOTENCY, newKey())
          .send({ recipientId: randomUUID(), amount: 1000 })
      ).status,
    ).toBe(401);
  });
});
