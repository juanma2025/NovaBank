/**
 * Spec 004 · US3 — Pagos en la tienda demo (tasks.md T024). Límites de prueba (vitest.config.ts):
 * $1.000 a $50.000 por pago y $60.000 por día. Recargas: máximo $50.000 cada una.
 */
import { Writable } from 'node:stream';

import {
  CardPaymentResultSchema,
  CardPaymentsPageSchema,
  luhnCheckDigit,
  PaymentLimitsSchema,
} from '@nova/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLogger } from '../../src/lib/logger.js';
import {
  balanceOf,
  createCardholder,
  expiryOf,
  fund,
  issueCard,
  pay,
  paymentBody,
  revealCard,
} from '../helpers/cards.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase } from '../helpers/test-db.js';
import { IDEMPOTENCY, newKey, renewSession } from '../helpers/users.js';

const STORE = '/api/v1/store';
const logLines: string[] = [];
const sink = new Writable({
  write(chunk: Buffer, _encoding, done) {
    logLines.push(chunk.toString('utf8'));
    done();
  },
});
let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp({}, { logger: createLogger('trace', sink) });
});
afterAll(async () => {
  await t.close();
});

/** Estudiante con saldo, una tarjeta activa y sus datos completos. */
async function setup(prefix: string, balance = 50_000) {
  const user = await createCardholder(t, prefix);
  if (balance > 0) await fund(user, balance);
  // El reloj de prueba no avanza solo: los pagos quedan después de las recargas en el historial.
  t.clock.advanceSeconds(1);
  const card = await issueCard(user);
  const secrets = await revealCard(user, card.id);
  return { user, card, secrets };
}

describe('US3 · pago aprobado (FR-012, FR-017, FR-019, FR-020)', () => {
  it('descuenta el saldo, crea el movimiento y el pago de la tarjeta con su categoría', async () => {
    const { user, card, secrets } = await setup('aprobado');
    const spaced = secrets.number.replace(/(\d{4})/g, '$1 ').trim();
    const res = await pay(user, { ...paymentBody(secrets, 12_000), cardNumber: spaced });
    expect(res.status).toBe(201);
    const body = CardPaymentResultSchema.parse(res.body);
    const description = `Compra en Cafetería Central · •••• ${card.last4}`;
    expect(body).toMatchObject({ balance: 38_000, cardLast4: card.last4 });
    expect(body.movement).toMatchObject({
      type: 'card_payment',
      amount: -12_000,
      description,
      note: null,
      status: 'completed',
    });
    expect(await balanceOf(user)).toBe(38_000);
    expect((await user.agent.get('/api/v1/accounts/me')).body.recentMovements[0]).toMatchObject({
      type: 'card_payment',
      description,
    });

    const page = CardPaymentsPageSchema.parse(
      (await user.agent.get(`/api/v1/cards/${card.id}/payments`)).body,
    );
    expect(page.items).toEqual([
      expect.objectContaining({
        merchantId: 'cafeteria-central',
        merchantName: 'Cafetería Central',
        category: 'food',
        amount: 12_000,
        transactionId: body.movement.transactionId,
      }),
    ]);
    expect(page.nextCursor).toBeNull();
  });

  it('los pagos de una tarjeta se paginan del más reciente al más antiguo', async () => {
    const { user, card, secrets } = await setup('pagina');
    for (const merchant of ['libreria-campus', 'bus-universitario', 'cine-estudiantil']) {
      expect((await pay(user, paymentBody(secrets, 1000, merchant))).status).toBe(201);
      t.clock.advanceSeconds(1);
    }
    const first = CardPaymentsPageSchema.parse(
      (await user.agent.get(`/api/v1/cards/${card.id}/payments?limit=2`)).body,
    );
    expect(first.items.map((p) => p.merchantId)).toEqual(['cine-estudiantil', 'bus-universitario']);
    const second = CardPaymentsPageSchema.parse(
      (
        await user.agent.get(
          `/api/v1/cards/${card.id}/payments?limit=2&cursor=${first.nextCursor ?? ''}`,
        )
      ).body,
    );
    expect(second.items.map((p) => p.category)).toEqual(['books']);
    expect(second.nextCursor).toBeNull();
  });
});

describe('US3 · tarjeta no activa (FR-013, regla de dominio 8)', () => {
  it('congelada o cancelada: CARD_NOT_ACTIVE sin mover dinero', async () => {
    const { user, card, secrets } = await setup('congelada');
    await user.agent.post(`/api/v1/cards/${card.id}/freeze`);
    const frozen = await pay(user, paymentBody(secrets, 5000));
    expect(frozen.status).toBe(422);
    expect(frozen.body.error.code).toBe('CARD_NOT_ACTIVE');

    await user.agent.post(`/api/v1/cards/${card.id}/cancel`);
    expect((await pay(user, paymentBody(secrets, 5000))).body.error.code).toBe('CARD_NOT_ACTIVE');
    expect(await balanceOf(user)).toBe(50_000);
  });
});

describe('US3 · datos que no coinciden (FR-014)', () => {
  it('número, vencimiento o CVV equivocados, o una tarjeta ajena: el mismo rechazo genérico', async () => {
    const { user, secrets } = await setup('rechazos');
    const other = await setup('ajena', 0);
    const base = '9' + secrets.number.slice(1, 15);
    const wrongNumber = `${base.slice(0, -1)}${(Number(base.at(-1)) + 1) % 10}`;
    const wrongCvv = String((Number(secrets.cvv) + 1) % 1000).padStart(3, '0');
    const attempts = [
      { ...paymentBody(secrets, 1000), cvv: wrongCvv },
      {
        ...paymentBody(secrets, 1000),
        expiry: expiryOf({ ...secrets, expYear: secrets.expYear + 1 }),
      },
      { ...paymentBody(secrets, 1000), cardNumber: `${wrongNumber}${luhnCheckDigit(wrongNumber)}` },
      paymentBody(other.secrets, 1000),
    ];
    const messages = new Set<string>();
    for (const body of attempts) {
      const res = await pay(user, body);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('CARD_DECLINED');
      messages.add(res.body.error.message as string);
    }
    expect(messages.size).toBe(1);
    expect(await balanceOf(user)).toBe(50_000);
    expect(await balanceOf(other.user)).toBe(0);
  });

  it('5 rechazos bloquean los pagos 15 minutos, incluso con los datos correctos', async () => {
    const { user, secrets } = await setup('bloqueo');
    const wrong = {
      ...paymentBody(secrets, 1000),
      cvv: String((Number(secrets.cvv) + 1) % 1000).padStart(3, '0'),
    };
    for (let i = 1; i <= 4; i += 1) {
      expect((await pay(user, wrong)).body.error.code, `intento ${i}`).toBe('CARD_DECLINED');
    }
    const locked = await pay(user, wrong);
    expect(locked.status).toBe(429);
    expect(locked.body.error).toMatchObject({
      code: 'CARD_PAYMENTS_LOCKED',
      details: { retryAfterSeconds: 900 },
    });
    expect(locked.headers['retry-after']).toBe('900');
    expect((await pay(user, paymentBody(secrets, 1000))).body.error.code).toBe(
      'CARD_PAYMENTS_LOCKED',
    );

    t.clock.advanceMinutes(16);
    await renewSession(t, user);
    expect((await pay(user, paymentBody(secrets, 1000))).status).toBe(201);
  });
});

describe('US3 · límites y saldo (FR-015, FR-016)', () => {
  it('fuera de rango: 422 con el rango permitido', async () => {
    const { user, secrets } = await setup('rango');
    for (const amount of [999, 50_001]) {
      const res = await pay(user, paymentBody(secrets, amount));
      expect(res.status, String(amount)).toBe(422);
      expect(res.body.error).toMatchObject({
        code: 'PAYMENT_AMOUNT_OUT_OF_RANGE',
        details: { minAmount: 1000, maxAmount: 50_000 },
      });
    }
  });

  it('tope diario de todas las tarjetas (las recargas no cuentan) y reinicio en el día de Bogotá', async () => {
    const { user, secrets } = await setup('tope', 100_000);
    const second = await issueCard(user, 'Otra');
    const secondSecrets = await revealCard(user, second.id);
    expect(PaymentLimitsSchema.parse((await user.agent.get(`${STORE}/limits`)).body)).toEqual({
      minAmount: 1000,
      maxAmount: 50_000,
      dailyLimit: 60_000,
      remainingToday: 60_000,
    });
    expect((await pay(user, paymentBody(secrets, 50_000))).status).toBe(201);
    expect((await pay(user, paymentBody(secondSecrets, 10_000))).status).toBe(201);
    const over = await pay(user, paymentBody(secrets, 1000));
    expect(over.status).toBe(422);
    expect(over.body.error).toMatchObject({
      code: 'PAYMENT_DAILY_LIMIT',
      details: { remainingToday: 0 },
    });

    t.clock.advanceMinutes(24 * 60);
    await renewSession(t, user);
    expect((await pay(user, paymentBody(secrets, 1000))).status).toBe(201);
  });

  it('saldo insuficiente: 422 con el disponible; pagar todo el saldo deja $0', async () => {
    const { user, secrets } = await setup('saldo', 5000);
    const over = await pay(user, paymentBody(secrets, 5001));
    expect(over.status).toBe(422);
    expect(over.body.error).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      details: { availableBalance: 5000 },
    });
    expect((await pay(user, paymentBody(secrets, 5000))).status).toBe(201);
    expect(await balanceOf(user)).toBe(0);
  });

  it('sin Idempotency-Key o con un cuerpo inválido: 400', async () => {
    const { user, secrets } = await setup('400', 0);
    expect((await user.agent.post(`${STORE}/payments`, paymentBody(secrets, 1000))).status).toBe(
      400,
    );
    for (const change of [
      { expiry: '13/30' },
      { cvv: '12' },
      { merchantId: 'otro' },
      { extra: 1 },
    ]) {
      const res = await pay(user, { ...paymentBody(secrets, 1000), ...change });
      expect(res.status, JSON.stringify(change)).toBe(400);
    }
  });
});

describe('US3 · idempotencia (FR-018)', () => {
  it('la misma clave y el mismo cuerpo devuelven la respuesta original sin otro pago', async () => {
    const { user, secrets } = await setup('idem');
    const key = newKey();
    const first = await pay(user, paymentBody(secrets, 4000), key);
    const again = await pay(user, paymentBody(secrets, 4000), key);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(await balanceOf(user)).toBe(46_000);
  });

  it('la misma clave con otro cuerpo: 409', async () => {
    const { user, secrets } = await setup('idem-409');
    const key = newKey();
    await pay(user, paymentBody(secrets, 4000), key);
    const other = await pay(user, paymentBody(secrets, 4001), key);
    expect(other.status).toBe(409);
    expect(other.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('un doble clic simultáneo aplica un solo pago', async () => {
    const { user, secrets } = await setup('doble');
    const key = newKey();
    const [a, b] = await Promise.all([
      pay(user, paymentBody(secrets, 3000), key),
      pay(user, paymentBody(secrets, 3000), key),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body).toEqual(b.body);
    expect(await balanceOf(user)).toBe(47_000);
  });
});

describe('US3 · concurrencia (regla de dominio 3)', () => {
  it('pagos simultáneos que superan el saldo: solo se aprueban los que caben', async () => {
    const { user, secrets } = await setup('sobregiro', 10_000);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => pay(user, paymentBody(secrets, 3000))),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.body?.error?.code === 'INSUFFICIENT_FUNDS')).toHaveLength(2);
    expect(await balanceOf(user)).toBe(1000);
  });

  it('congelar mientras hay pagos en curso: ninguno queda a medias', async () => {
    const { user, card, secrets } = await setup('congela-en-curso');
    const payments = Array.from({ length: 6 }, () => pay(user, paymentBody(secrets, 1000)));
    const freeze = user.agent.post(`/api/v1/cards/${card.id}/freeze`);
    const [results, frozen] = await Promise.all([Promise.all(payments), freeze]);
    expect(frozen.status).toBe(200);
    const approved = results.filter((r) => r.status === 201).length;
    expect(
      results.filter((r) => r.status !== 201).every((r) => r.body.error.code === 'CARD_NOT_ACTIVE'),
    ).toBe(true);
    expect(await t.prisma.cardPayment.count({ where: { cardId: card.id } })).toBe(approved);
    expect(await balanceOf(user)).toBe(50_000 - approved * 1000);
    // Ya congelada, todo pago se rechaza.
    expect((await pay(user, paymentBody(secrets, 1000))).body.error.code).toBe('CARD_NOT_ACTIVE');
  });
});

describe('US3 · auditoría, logs e invariantes', () => {
  it('queda auditado como CARD_PAYMENT_APPROVED sin datos de la tarjeta (FR-021)', async () => {
    const { user, card, secrets } = await setup('audita');
    const res = await pay(user, paymentBody(secrets, 2500, 'papeleria-express'));
    const event = await t.prisma.auditEvent.findFirstOrThrow({
      where: { userId: user.userId, type: 'CARD_PAYMENT_APPROVED' },
    });
    expect(event.metadata).toEqual({
      amount: 2500,
      transactionId: res.body.movement.transactionId,
      cardId: card.id,
      merchantId: 'papeleria-express',
    });
  });

  it('los logs no contienen el número completo ni el CVV (SC-005)', async () => {
    const { user, secrets } = await setup('logs');
    await pay(user, paymentBody(secrets, 1000));
    await pay(user, { ...paymentBody(secrets, 1000), cvv: '000' === secrets.cvv ? '001' : '000' });
    const logs = logLines.join('\n');
    expect(logs).not.toContain(secrets.number);
    expect(logs).not.toContain(`"cvv":"${secrets.cvv}"`);
  });

  it('la tabla card_payments es inmutable', async () => {
    const { user, card, secrets } = await setup('inmutable');
    await pay(user, paymentBody(secrets, 1000));
    const payment = await t.prisma.cardPayment.findFirstOrThrow({ where: { cardId: card.id } });
    await expect(
      t.prisma.cardPayment.update({ where: { id: payment.id }, data: { amount: 1n } }),
    ).rejects.toThrow(/inmutable/);
    await expect(t.prisma.cardPayment.delete({ where: { id: payment.id } })).rejects.toThrow(
      /inmutable/,
    );
  });

  it('la suma del libro es 0 y cada saldo coincide con sus asientos (SC-004)', async () => {
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
    expect((await request(t.app).get(`${STORE}/limits`)).status).toBe(401);
    expect(
      (await request(t.app).post(`${STORE}/payments`).set(IDEMPOTENCY, newKey()).send({})).status,
    ).toBe(401);
  });
});
