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
