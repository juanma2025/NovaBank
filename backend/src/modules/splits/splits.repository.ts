import type { Prisma, Split, SplitShare, SplitShareStatus, SplitStatus } from '@nova/db';

import type { CursorPosition } from '../../lib/cursor.js';
import type { Db } from '../../lib/db.js';

export type SplitWithShares = Split & { shares: SplitShare[] };

export interface NewSplit {
  creatorUserId: string;
  title: string;
  totalAmount: number;
  creatorShare: number;
  shares: { userId: string; amount: number }[];
  now: Date;
}

const withShares = {
  shares: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.SplitInclude;

/** Divisiones que la estudiante creó o en las que participa (FR-014). */
const visibleTo = (userId: string): Prisma.SplitWhereInput => ({
  OR: [{ creatorUserId: userId }, { shares: { some: { userId } } }],
});

/** Acceso a `splits` y `split_shares` (spec 007, data-model.md). Dueño: módulo splits. */
export const splitsRepository = {
  create(db: Db, split: NewSplit): Promise<SplitWithShares> {
    return db.split.create({
      data: {
        creatorUserId: split.creatorUserId,
        title: split.title,
        totalAmount: BigInt(split.totalAmount),
        creatorShare: BigInt(split.creatorShare),
        status: 'open',
        createdAt: split.now,
        updatedAt: split.now,
        shares: {
          create: split.shares.map((s) => ({
            userId: s.userId,
            amount: BigInt(s.amount),
            status: 'pending',
            createdAt: split.now,
          })),
        },
      },
      include: withShares,
    });
  },

  findVisible(db: Db, userId: string, id: string): Promise<SplitWithShares | null> {
    return db.split.findFirst({ where: { id, ...visibleTo(userId) }, include: withShares });
  },

  /** Bloquea la división (SQL explícito: SELECT … FOR UPDATE, research R2 y R5). */
  async lockSplit(db: Db, id: string): Promise<SplitWithShares | null> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM splits WHERE id = ${id}::uuid FOR UPDATE`;
    return rows[0] ? db.split.findUnique({ where: { id }, include: withShares }) : null;
  },

  /** Bloquea una parte de la división. */
  async lockShare(db: Db, splitId: string, shareId: string): Promise<SplitShare | null> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM split_shares WHERE id = ${shareId}::uuid AND split_id = ${splitId}::uuid FOR UPDATE`;
    return rows[0] ? db.splitShare.findUnique({ where: { id: shareId } }) : null;
  },

  /** Saca una parte de `pending` (el trigger impide cualquier otra transición). */
  resolveShare(
    db: Db,
    id: string,
    status: Exclude<SplitShareStatus, 'pending'>,
    now: Date,
    transferTransactionId: string | null = null,
  ): Promise<SplitShare> {
    return db.splitShare.update({
      where: { id },
      data: { status, resolvedAt: now, transferTransactionId },
    });
  },

  async cancelPendingShares(db: Db, splitId: string, now: Date): Promise<void> {
    await db.splitShare.updateMany({
      where: { splitId, status: 'pending' },
      data: { status: 'canceled', resolvedAt: now },
    });
  },

  setReminded(db: Db, id: string, now: Date): Promise<SplitShare> {
    return db.splitShare.update({ where: { id }, data: { lastRemindedAt: now } });
  },

  countPending(db: Db, splitId: string): Promise<number> {
    return db.splitShare.count({ where: { splitId, status: 'pending' } });
  },

  async close(db: Db, id: string, status: Exclude<SplitStatus, 'open'>, now: Date): Promise<void> {
    await db.split.update({ where: { id }, data: { status, closedAt: now, updatedAt: now } });
  },

  /** Página por cursor en orden (created_at DESC, id DESC). */
  list(db: Db, userId: string, take: number, after?: CursorPosition): Promise<SplitWithShares[]> {
    return db.split.findMany({
      where: {
        AND: [
          visibleTo(userId),
          after
            ? {
                OR: [
                  { createdAt: { lt: after.createdAt } },
                  { createdAt: after.createdAt, id: { lt: after.id } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      include: withShares,
    });
  },

  /** Partes pendientes de divisiones abiertas: las que cobra y las que debe (research R8). */
  async pendingTotals(db: Db, userId: string) {
    const [toCollect, toPay] = await Promise.all([
      db.splitShare.aggregate({
        where: { status: 'pending', split: { status: 'open', creatorUserId: userId } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      db.splitShare.aggregate({
        where: { status: 'pending', userId, split: { status: 'open' } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    return {
      toCollect: { count: toCollect._count._all, amount: toCollect._sum.amount ?? 0n },
      toPay: { count: toPay._count._all, amount: toPay._sum.amount ?? 0n },
    };
  },
};
