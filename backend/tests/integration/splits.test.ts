/**
 * Spec 007 — Gastos compartidos (tasks.md T011 y T017). Límites de prueba (vitest.config.ts):
 * transferencias de $1.000 a $50.000, con contraseña por encima de $20.000.
 */
import { PayShareResultSchema, SplitSchema, SplitsPageSchema, type Split } from '@nova/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { balanceOf, fund } from '../helpers/cards.js';
import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase } from '../helpers/test-db.js';
import {
  IDEMPOTENCY,
  type TestUser,
  createUserWithSession,
  newKey,
  renewSession,
} from '../helpers/users.js';

const SPLITS = '/api/v1/splits';
const PASSWORD = 'una clave bastante larga';
let t: TestApp;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
});
afterAll(async () => {
  await t.close();
});

interface Group {
  ana: TestUser;
  juan: TestUser;
  laura: TestUser;
}

/** Ana crea; Juan y Laura participan. Juan tiene saldo; Laura, `lauraBalance`. */
async function group(prefix: string, lauraBalance = 50_000): Promise<Group> {
  const ana = await createUserWithSession(t, `${prefix}-ana`, {
    fullName: 'Ana Pérez Gómez',
    password: PASSWORD,
  });
  const juan = await createUserWithSession(t, `${prefix}-juan`, {
    fullName: 'Juan Carlos Ríos',
    password: PASSWORD,
  });
  const laura = await createUserWithSession(t, `${prefix}-laura`, {
    fullName: 'Laura Martínez',
    password: PASSWORD,
  });
  await fund(juan, 50_000);
  if (lauraBalance > 0) await fund(laura, lauraBalance);
  await ana.agent.get('/api/v1/accounts/me');
  return { ana, juan, laura };
}

async function recipientId(from: TestUser, to: TestUser): Promise<string> {
  const res = await from.agent.get(`/api/v1/transfers/recipient?q=${encodeURIComponent(to.email)}`);
  expect(res.status).toBe(200);
  return res.body.recipientId as string;
}

async function createSplit(g: Group, amounts = [10_000, 10_000], creatorShare = 10_000) {
  const ids = [await recipientId(g.ana, g.juan), await recipientId(g.ana, g.laura)];
  const res = await g.ana.agent.post(SPLITS, {
    title: 'Cena',
    totalAmount: creatorShare + amounts.reduce((a, b) => a + b, 0),
    creatorShare,
    shares: amounts.map((amount, i) => ({ recipientId: ids[i], amount })),
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return SplitSchema.parse(res.body);
}

function payShare(user: TestUser, splitId: string, body: object = {}, key = newKey()) {
  return user.agent.post(`${SPLITS}/${splitId}/shares/me/pay`, body, { [IDEMPOTENCY]: key });
}

function shareOf(split: Split, displayName: string) {
  const share = split.shares.find((s) => s.displayName === displayName);
  if (!share) throw new Error(`sin parte de ${displayName}`);
  return share;
}

/** Entrega toda la bandeja (cada llamada atiende un lote) y devuelve los asuntos recibidos. */
async function emailsTo(user: TestUser) {
  while ((await t.deliverEmails()) > 0) {
    // sigue con el siguiente lote
  }
  return t.mail.to(user.email).map((m) => m.subject);
}

async function transfersFrom(user: TestUser): Promise<number> {
  return t.prisma.ledgerTransaction.count({
    where: { type: 'transfer', account: { userId: user.userId } },
  });
}

describe('US1 · crear (FR-001–FR-004, FR-015)', () => {
  it('crea una división abierta sin mover dinero y avisa a cada participante', async () => {
    const g = await group('crea');
    const ledgerBefore = await t.prisma.ledgerTransaction.count();
    const split = await createSplit(g);
    expect(split).toMatchObject({
      title: 'Cena',
      totalAmount: 30_000,
      creatorShare: 10_000,
      creatorName: 'Ana P. G.',
      role: 'creator',
      status: 'open',
      closedAt: null,
    });
    expect(split.shares.map((s) => [s.displayName, s.amount, s.status, s.isMe]).sort()).toEqual([
      ['Juan C. R.', 10_000, 'pending', false],
      ['Laura M.', 10_000, 'pending', false],
    ]);
    // FR-004 y SC-004: crear no mueve dinero.
    expect(await t.prisma.ledgerTransaction.count()).toBe(ledgerBefore);
    expect(await balanceOf(g.ana)).toBe(0);
    expect(await emailsTo(g.juan)).toContain('Ana P. G. dividió «Cena» contigo');
    expect(await emailsTo(g.laura)).toContain('Ana P. G. dividió «Cena» contigo');
    // Nunca el correo completo de los demás (FR-013).
    expect(JSON.stringify(split)).not.toContain(g.juan.email);
  });

  it('la suma que no cuadra y las partes fuera del rango de transferencias: 422', async () => {
    const g = await group('montos');
    const ids = [await recipientId(g.ana, g.juan)];
    const mismatch = await g.ana.agent.post(SPLITS, {
      title: 'X',
      totalAmount: 20_000,
      creatorShare: 5000,
      shares: [{ recipientId: ids[0], amount: 10_000 }],
    });
    expect(mismatch.body.error.code).toBe('SPLIT_SHARES_MISMATCH');
    for (const amount of [999, 50_001]) {
      const res = await g.ana.agent.post(SPLITS, {
        title: 'X',
        totalAmount: amount + 5000,
        creatorShare: 5000,
        shares: [{ recipientId: ids[0], amount }],
      });
      expect(res.body.error, String(amount)).toMatchObject({
        code: 'SPLIT_SHARE_OUT_OF_RANGE',
        details: { minAmount: 1000, maxAmount: 50_000 },
      });
    }
  });

  it('participantes repetidos, quien crea como participante o inexistentes: 400/404', async () => {
    const g = await group('participantes');
    const juanId = await recipientId(g.ana, g.juan);
    const anaAccount = (await g.ana.agent.get('/api/v1/accounts/me')).body.id as string;
    const base = { title: 'X', totalAmount: 21_000, creatorShare: 1000 };
    const dup = await g.ana.agent.post(SPLITS, {
      ...base,
      shares: [
        { recipientId: juanId, amount: 10_000 },
        { recipientId: juanId, amount: 10_000 },
      ],
    });
    expect(dup.body.error.details.fields.shares).toBe('duplicate');
    const self = await g.ana.agent.post(SPLITS, {
      ...base,
      shares: [
        { recipientId: juanId, amount: 10_000 },
        { recipientId: anaAccount, amount: 10_000 },
      ],
    });
    expect(self.body.error.details.fields.shares).toBe('includes_creator');
    const missing = await g.ana.agent.post(SPLITS, {
      ...base,
      totalAmount: 11_000,
      shares: [{ recipientId: '7b0e4c1a-3f2d-4e5b-9a8c-1d2e3f4a5b6c', amount: 10_000 }],
    });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('RECIPIENT_NOT_FOUND');
  });

  it('la ven quien la creó y quienes participan; los demás reciben 404 (FR-014)', async () => {
    const g = await group('visible');
    const outsider = await createUserWithSession(t, 'visible-otro');
    const split = await createSplit(g);
    const asJuan = SplitSchema.parse((await g.juan.agent.get(`${SPLITS}/${split.id}`)).body);
    expect(asJuan.role).toBe('participant');
    expect(shareOf(asJuan, 'Juan C. R.').isMe).toBe(true);
    expect((await outsider.agent.get(`${SPLITS}/${split.id}`)).status).toBe(404);
    expect((await g.juan.agent.get(`${SPLITS}/no-es-uuid`)).status).toBe(404);
  });
});

describe('US1 · pagar mi parte (FR-005, FR-006, FR-009)', () => {
  it('es una transferencia normal a quien creó, con la nota, y marca la parte pagada', async () => {
    const g = await group('paga');
    const split = await createSplit(g);
    const res = await payShare(g.juan, split.id);
    expect(res.status).toBe(201);
    const body = PayShareResultSchema.parse(res.body);
    expect(body.movement).toMatchObject({
      type: 'transfer',
      amount: -10_000,
      description: 'Transferencia a Ana P. G.',
      note: 'Gasto compartido: Cena',
    });
    expect(body.balance).toBe(40_000);
    expect(shareOf(body.split, 'Juan C. R.').status).toBe('paid');
    expect(body.split.status).toBe('open');
    expect(await balanceOf(g.juan)).toBe(40_000);
    expect(await balanceOf(g.ana)).toBe(10_000);
    const row = await t.prisma.splitShare.findFirstOrThrow({
      where: { splitId: split.id, userId: g.juan.userId },
    });
    expect(row.transferTransactionId).toBe(body.movement.transactionId);
    expect(await emailsTo(g.ana)).toContain('Juan C. R. pagó su parte de «Cena»');
  });

  it('la última parte completa la división', async () => {
    const g = await group('completa');
    const split = await createSplit(g);
    await payShare(g.juan, split.id);
    const last = await payShare(g.laura, split.id);
    expect(last.body.split.status).toBe('completed');
    expect(last.body.split.closedAt).not.toBeNull();
  });

  it('hereda las reglas de las transferencias: contraseña sobre el umbral y saldo', async () => {
    const g = await group('reglas', 0);
    const split = await createSplit(g, [25_000, 5000], 0);
    const required = await payShare(g.juan, split.id);
    expect(required.body.error.code).toBe('REAUTH_REQUIRED');
    expect((await payShare(g.juan, split.id, { password: PASSWORD })).status).toBe(201);

    const poor = await payShare(g.laura, split.id);
    expect(poor.body.error).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      details: { availableBalance: 0 },
    });
    const fresh = SplitSchema.parse((await g.laura.agent.get(`${SPLITS}/${split.id}`)).body);
    expect(shareOf(fresh, 'Laura M.').status).toBe('pending');
  });

  it('una parte ya pagada no se paga otra vez; la misma clave devuelve lo mismo', async () => {
    const g = await group('una-vez');
    const split = await createSplit(g);
    const key = newKey();
    const first = await payShare(g.juan, split.id, {}, key);
    const replay = await payShare(g.juan, split.id, {}, key);
    expect(replay.status).toBe(201);
    expect(replay.body.movement).toEqual(first.body.movement);
    const again = await payShare(g.juan, split.id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('SHARE_NOT_PENDING');
    expect(await balanceOf(g.juan)).toBe(40_000);
    expect(await transfersFrom(g.juan)).toBe(1);
  });

  it('dos pagos simultáneos de la misma parte: una sola transferencia (SC-003)', async () => {
    const g = await group('simultaneos');
    const split = await createSplit(g);
    const results = await Promise.all([payShare(g.juan, split.id), payShare(g.juan, split.id)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await transfersFrom(g.juan)).toBe(1);
    expect(await balanceOf(g.juan)).toBe(40_000);
  });

  it('quien creó la división no tiene parte que pagar: 404', async () => {
    const g = await group('sin-parte');
    const split = await createSplit(g);
    expect((await payShare(g.ana, split.id)).status).toBe(404);
  });
});

describe('US2 · seguir (FR-012)', () => {
  it('lista y resumen de lo que me deben y lo que debo', async () => {
    const g = await group('lista');
    const first = await createSplit(g);
    t.clock.advanceSeconds(1);
    await createSplit(g, [5000, 5000], 0);
    await payShare(g.juan, first.id);

    const summary = (await g.ana.agent.get(`${SPLITS}/summary`)).body;
    expect(summary).toEqual({
      toCollect: { count: 3, amount: 20_000 },
      toPay: { count: 0, amount: 0 },
    });
    expect((await g.juan.agent.get(`${SPLITS}/summary`)).body.toPay).toEqual({
      count: 1,
      amount: 5000,
    });

    const page = SplitsPageSchema.parse((await g.juan.agent.get(`${SPLITS}?limit=1`)).body);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      role: 'participant',
      totalAmount: 10_000,
      myShare: { amount: 5000, status: 'pending' },
    });
    const rest = SplitsPageSchema.parse(
      (await g.juan.agent.get(`${SPLITS}?limit=1&cursor=${page.nextCursor ?? ''}`)).body,
    );
    expect(rest.items[0]).toMatchObject({ myShare: { status: 'paid' }, pendingCount: 1 });
    expect(rest.nextCursor).toBeNull();
  });
});

describe('US2 · gestionar (FR-007, FR-008, FR-010, FR-011)', () => {
  it('marcar pagada por fuera y rechazar no mueven dinero y completan la división', async () => {
    const g = await group('gestiona');
    const split = await createSplit(g);
    const ledgerBefore = await t.prisma.ledgerTransaction.count();
    const laura = shareOf(split, 'Laura M.');
    const marked = await g.ana.agent.post(`${SPLITS}/${split.id}/shares/${laura.id}/mark-paid`);
    expect(shareOf(SplitSchema.parse(marked.body), 'Laura M.').status).toBe('paid_outside');
    const declined = await g.juan.agent.post(`${SPLITS}/${split.id}/shares/me/decline`);
    const body = SplitSchema.parse(declined.body);
    expect(shareOf(body, 'Juan C. R.').status).toBe('declined');
    expect(body.status).toBe('completed');
    expect(await t.prisma.ledgerTransaction.count()).toBe(ledgerBefore);
    // Ya resueltas: otra acción → 409.
    expect((await g.juan.agent.post(`${SPLITS}/${split.id}/shares/me/decline`)).status).toBe(409);
  });

  it('recordatorio: correo; otro antes de 24 h → 429 con retryAfterSeconds', async () => {
    const g = await group('recuerda');
    const split = await createSplit(g);
    const juan = shareOf(split, 'Juan C. R.');
    const path = `${SPLITS}/${split.id}/shares/${juan.id}/remind`;
    const first = await g.ana.agent.post(path);
    expect(first.status).toBe(200);
    expect(shareOf(SplitSchema.parse(first.body), 'Juan C. R.').lastRemindedAt).not.toBeNull();
    expect(await emailsTo(g.juan)).toContain('Recordatorio: tu parte de «Cena»');
    const soon = await g.ana.agent.post(path);
    expect(soon.status).toBe(429);
    expect(soon.body.error).toMatchObject({
      code: 'SPLIT_REMINDER_TOO_SOON',
      details: { retryAfterSeconds: 24 * 60 * 60 },
    });
    t.clock.advanceMinutes(24 * 60 + 1);
    await renewSession(t, g.ana);
    expect((await g.ana.agent.post(path)).status).toBe(200);
  });

  it('cancelar: pendientes canceladas, pagadas intactas; después nada se puede pagar', async () => {
    const g = await group('cancela');
    const split = await createSplit(g);
    await payShare(g.juan, split.id);
    const canceled = SplitSchema.parse(
      (await g.ana.agent.post(`${SPLITS}/${split.id}/cancel`)).body,
    );
    expect(canceled.status).toBe('canceled');
    expect(shareOf(canceled, 'Juan C. R.').status).toBe('paid');
    expect(shareOf(canceled, 'Laura M.').status).toBe('canceled');
    expect(await balanceOf(g.ana)).toBe(10_000);

    const pay = await payShare(g.laura, split.id);
    expect(pay.body.error.code).toBe('SPLIT_CLOSED');
    expect(await balanceOf(g.laura)).toBe(50_000);
    expect((await g.ana.agent.post(`${SPLITS}/${split.id}/cancel`)).body.error.code).toBe(
      'SPLIT_CLOSED',
    );
    const laura = shareOf(canceled, 'Laura M.');
    const mark = await g.ana.agent.post(`${SPLITS}/${split.id}/shares/${laura.id}/mark-paid`);
    expect(mark.body.error.code).toBe('SPLIT_CLOSED');
  });

  it('pagar mientras se cancela: nunca se transfiere por una parte cancelada', async () => {
    const g = await group('carrera');
    const split = await createSplit(g);
    const [pay, cancel] = await Promise.all([
      payShare(g.juan, split.id),
      g.ana.agent.post(`${SPLITS}/${split.id}/cancel`),
    ]);
    expect(cancel.status).toBe(200);
    const final = SplitSchema.parse((await g.ana.agent.get(`${SPLITS}/${split.id}`)).body);
    const juan = shareOf(final, 'Juan C. R.');
    if (pay.status === 201) {
      expect(juan.status).toBe('paid');
      expect(await transfersFrom(g.juan)).toBe(1);
    } else {
      expect(pay.body.error.code).toBe('SPLIT_CLOSED');
      expect(juan.status).toBe('canceled');
      expect(await transfersFrom(g.juan)).toBe(0);
    }
    expect(await balanceOf(g.juan)).toBe(50_000 - (await transfersFrom(g.juan)) * 10_000);
  });

  it('las acciones de quien creó, pedidas por otra persona → 404', async () => {
    const g = await group('permisos');
    const outsider = await createUserWithSession(t, 'permisos-otro');
    const split = await createSplit(g);
    const laura = shareOf(split, 'Laura M.');
    for (const user of [g.juan, outsider]) {
      expect((await user.agent.post(`${SPLITS}/${split.id}/cancel`)).status).toBe(404);
      expect(
        (await user.agent.post(`${SPLITS}/${split.id}/shares/${laura.id}/mark-paid`)).status,
      ).toBe(404);
      expect(
        (await user.agent.post(`${SPLITS}/${split.id}/shares/${laura.id}/remind`)).status,
      ).toBe(404);
    }
    expect((await outsider.agent.post(`${SPLITS}/${split.id}/shares/me/decline`)).status).toBe(404);
  });
});

describe('garantías de la base e invariantes', () => {
  it('una parte resuelta no cambia, una división cerrada no se reabre, y nada se borra', async () => {
    const g = await group('base');
    const split = await createSplit(g);
    await g.juan.agent.post(`${SPLITS}/${split.id}/shares/me/decline`);
    const juan = await t.prisma.splitShare.findFirstOrThrow({
      where: { splitId: split.id, userId: g.juan.userId },
    });
    await expect(
      t.prisma.splitShare.update({
        where: { id: juan.id },
        data: { status: 'pending', resolvedAt: null },
      }),
    ).rejects.toThrow(/resuelta no puede cambiar/);
    await g.ana.agent.post(`${SPLITS}/${split.id}/cancel`);
    await expect(
      t.prisma.split.update({ where: { id: split.id }, data: { status: 'open', closedAt: null } }),
    ).rejects.toThrow(/cerrada no puede cambiar/);
    await expect(t.prisma.splitShare.delete({ where: { id: juan.id } })).rejects.toThrow();
  });

  it('la suma del libro es 0 y cada saldo coincide con sus asientos', async () => {
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
    expect((await request(t.app).get(SPLITS)).status).toBe(401);
    expect((await request(t.app).get(`${SPLITS}/summary`)).status).toBe(401);
  });
});
