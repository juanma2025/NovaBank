/**
 * Garantías del libro contable en PostgreSQL (spec 002: reglas de dominio 2, 3 y 7; SC-003;
 * tasks.md T017).
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../helpers/test-app.js';
import { resetDatabase } from '../helpers/test-db.js';
import { createUserWithSession } from '../helpers/users.js';

let t: TestApp;
let studentId: string;
let systemId: string;

beforeAll(async () => {
  await resetDatabase();
  t = createTestApp();
  const { userId } = await createUserWithSession(t);
  studentId = (await t.banking.accounts.ensureForUser(t.prisma, userId)).id;
  systemId = await t.banking.accounts.getSystemTopupsAccountId(t.prisma);
});
afterAll(async () => {
  await t.close();
});

/** Inserta una operación con los asientos dados dentro de una transacción. */
function insertOperation(lines: { accountId: string; amount: number }[]) {
  return t.prisma.$transaction(async (tx) => {
    const op = await tx.ledgerTransaction.create({
      data: {
        type: 'topup',
        status: 'pending',
        accountId: studentId,
        amount: 1000n,
        description: 'Prueba',
        requestId: randomUUID(),
        createdAt: new Date(),
      },
    });
    if (lines.length > 0) {
      await tx.ledgerEntry.createMany({
        data: lines.map((l) => ({
          transactionId: op.id,
          accountId: l.accountId,
          amount: BigInt(l.amount),
          createdAt: new Date(),
        })),
      });
    }
    return op;
  });
}

describe('doble entrada (FR-005)', () => {
  it('asientos que no suman cero fallan al confirmar', async () => {
    await expect(
      insertOperation([
        { accountId: studentId, amount: 1000 },
        { accountId: systemId, amount: -999 },
      ]),
    ).rejects.toThrow(/desbalanceado/);
  });

  it('una operación con un solo asiento, o sin asientos, falla', async () => {
    await expect(insertOperation([{ accountId: studentId, amount: 1000 }])).rejects.toThrow(
      /desbalanceado/,
    );
    await expect(insertOperation([])).rejects.toThrow(/desbalanceado/);
  });

  it('una operación balanceada se confirma', async () => {
    const op = await insertOperation([
      { accountId: studentId, amount: 1000 },
      { accountId: systemId, amount: -1000 },
    ]);
    expect(op.id).toBeDefined();
  });
});

describe('inmutabilidad y estados (FR-006, FR-007)', () => {
  it('UPDATE, DELETE y TRUNCATE sobre ledger_entries fallan', async () => {
    await expect(
      t.prisma.$executeRawUnsafe('UPDATE ledger_entries SET amount = 1'),
    ).rejects.toThrow(/inmutable/);
    await expect(t.prisma.$executeRawUnsafe('DELETE FROM ledger_entries')).rejects.toThrow(
      /inmutable/,
    );
    await expect(t.prisma.$executeRawUnsafe('TRUNCATE ledger_entries CASCADE')).rejects.toThrow(
      /inmutable/,
    );
  });

  it('solo se permite pending → completed | failed | reversed', async () => {
    const op = await insertOperation([
      { accountId: studentId, amount: 500 },
      { accountId: systemId, amount: -500 },
    ]);
    await t.prisma.ledgerTransaction.update({
      where: { id: op.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    await expect(
      t.prisma.ledgerTransaction.update({ where: { id: op.id }, data: { status: 'pending' } }),
    ).rejects.toThrow(/transición de estado no permitida/);
    await expect(
      t.prisma.ledgerTransaction.update({ where: { id: op.id }, data: { status: 'reversed' } }),
    ).rejects.toThrow(/transición de estado no permitida/);
  });

  it('al completar una operación no se puede cambiar su monto', async () => {
    const op = await insertOperation([
      { accountId: studentId, amount: 700 },
      { accountId: systemId, amount: -700 },
    ]);
    await expect(
      t.prisma.ledgerTransaction.update({
        where: { id: op.id },
        data: { status: 'completed', amount: 1n },
      }),
    ).rejects.toThrow(/solo status y completed_at/);
  });
});

describe('transferencias en el libro (spec 003, data-model.md)', () => {
  function insertTransfer(counterpartyAccountId: string | null) {
    return t.prisma.ledgerTransaction.create({
      data: {
        type: 'transfer',
        status: 'pending',
        accountId: studentId,
        counterpartyAccountId,
        amount: 1000n,
        description: 'Prueba',
        requestId: randomUUID(),
        createdAt: new Date(),
      },
    });
  }

  it('una transferencia exige contraparte distinta de la cuenta de origen', async () => {
    await expect(insertTransfer(null)).rejects.toThrow();
    await expect(insertTransfer(studentId)).rejects.toThrow();
  });

  it('contraparte y nota no pueden cambiar al completar la operación', async () => {
    const { userId } = await createUserWithSession(t, 'contraparte');
    const other = (await t.banking.accounts.ensureForUser(t.prisma, userId)).id;
    const op = await t.prisma.$transaction(async (tx) => {
      const created = await tx.ledgerTransaction.create({
        data: {
          type: 'transfer',
          status: 'pending',
          accountId: studentId,
          counterpartyAccountId: other,
          note: 'original',
          amount: 1n,
          description: 'Prueba',
          requestId: randomUUID(),
          createdAt: new Date(),
        },
      });
      await tx.ledgerEntry.createMany({
        data: [
          { transactionId: created.id, accountId: studentId, amount: -1n, createdAt: new Date() },
          { transactionId: created.id, accountId: other, amount: 1n, createdAt: new Date() },
        ],
      });
      return created;
    });
    for (const change of [{ note: 'cambiada' }, { counterpartyAccountId: systemId }]) {
      await expect(
        t.prisma.ledgerTransaction.update({
          where: { id: op.id },
          data: { status: 'completed', ...change },
        }),
        JSON.stringify(change),
      ).rejects.toThrow(/solo status y completed_at/);
    }
  });
});

describe('saldo nunca negativo (regla de dominio 3)', () => {
  it('el CHECK rechaza un saldo de estudiante negativo', async () => {
    await expect(
      t.prisma.account.update({ where: { id: studentId }, data: { balance: -1n } }),
    ).rejects.toThrow();
  });
});

describe('invariantes tras recargas reales (SC-003)', () => {
  it('la suma del libro es 0 y cada saldo coincide con sus asientos', async () => {
    // Cuenta que solo usa el flujo real (las pruebas anteriores insertan asientos a mano).
    const { agent, userId } = await createUserWithSession(t, 'invariantes');
    for (const amount of [1000, 25_000, 50_000]) {
      const res = await agent.post(
        '/api/v1/topups',
        { amount },
        { 'Idempotency-Key': `inv-${amount}` },
      );
      expect(res.status).toBe(201);
    }
    const total = await t.prisma.$queryRaw<
      { s: bigint }[]
    >`SELECT COALESCE(SUM(amount), 0) AS s FROM ledger_entries`;
    expect(Number(total[0]?.s)).toBe(0);
    const mismatched = await t.prisma.$queryRaw<{ id: string }[]>`
      SELECT a.id FROM accounts a
      WHERE a.kind = 'student' AND a.user_id = ${userId}::uuid
        AND a.balance <> (SELECT COALESCE(SUM(e.amount), 0) FROM ledger_entries e WHERE e.account_id = a.id)`;
    expect(mismatched).toEqual([]);
    const account = await t.prisma.account.findUniqueOrThrow({ where: { userId } });
    expect(account.balance).toBe(76_000n);
  });
});
