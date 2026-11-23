import type { LedgerEntry, LedgerTransaction, LedgerTransactionType, Prisma } from '@nova/db';

import type { Db } from '../../lib/db.js';

export type EntryWithTransaction = LedgerEntry & { transaction: LedgerTransaction };

/** Acceso a `ledger_transactions` y `ledger_entries` (spec 002, data-model.md). Dueño: ledger. */
export const ledgerRepository = {
  createTransaction(
    db: Db,
    data: Prisma.LedgerTransactionUncheckedCreateInput,
  ): Promise<LedgerTransaction> {
    return db.ledgerTransaction.create({ data });
  },

  async createEntries(db: Db, data: Prisma.LedgerEntryCreateManyInput[]): Promise<void> {
    await db.ledgerEntry.createMany({ data });
  },

  /** La transición la valida el trigger de la base (pending → completed). */
  completeTransaction(db: Db, id: string, now: Date): Promise<LedgerTransaction> {
    return db.ledgerTransaction.update({
      where: { id },
      data: { status: 'completed', completedAt: now },
    });
  },

  findEntry(
    db: Db,
    transactionId: string,
    accountId: string,
  ): Promise<EntryWithTransaction | null> {
    return db.ledgerEntry.findFirst({
      where: { transactionId, accountId },
      include: { transaction: true },
    });
  },

  /** Página por cursor en orden (created_at DESC, id DESC) (research R8). */
  listEntries(
    db: Db,
    accountId: string,
    take: number,
    after?: { createdAt: Date; id: string },
  ): Promise<EntryWithTransaction[]> {
    return db.ledgerEntry.findMany({
      where: {
        accountId,
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      include: { transaction: true },
    });
  },

  /** Spec 006: operaciones completadas de una cuenta y tipo en [desde, hasta), más nuevas primero. */
  listCompletedBetween(
    db: Db,
    accountId: string,
    type: LedgerTransactionType,
    range: { from: Date; to: Date },
    page?: { take: number; after?: { createdAt: Date; id: string } | undefined },
  ): Promise<LedgerTransaction[]> {
    const after = page?.after;
    return db.ledgerTransaction.findMany({
      where: {
        accountId,
        type,
        status: 'completed',
        createdAt: { gte: range.from, lt: range.to },
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(page ? { take: page.take } : {}),
    });
  },

  findTransaction(db: Db, id: string): Promise<LedgerTransaction | null> {
    return db.ledgerTransaction.findUnique({ where: { id } });
  },

  /** Spec 005: suma de los montos de operaciones dadas (research R7). */
  async sumAmountsByIds(db: Db, ids: string[]): Promise<bigint> {
    if (ids.length === 0) return 0n;
    const result = await db.ledgerTransaction.aggregate({
      where: { id: { in: ids } },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0n;
  },

  async sumCompletedSince(
    db: Db,
    accountId: string,
    type: LedgerTransactionType,
    since: Date,
  ): Promise<bigint> {
    const result = await db.ledgerTransaction.aggregate({
      where: { accountId, type, status: 'completed', createdAt: { gte: since } },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0n;
  },
};
