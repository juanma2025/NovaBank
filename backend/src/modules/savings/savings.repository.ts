import type { SavingsGoal } from '@nova/db';

import type { Db } from '../../lib/db.js';

export interface NewGoal {
  userId: string;
  accountId: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  now: Date;
}

export interface GoalChanges {
  name?: string | undefined;
  targetAmount?: number | undefined;
  /** `null` quita la fecha; `undefined` la deja igual. */
  targetDate?: string | null | undefined;
}

/** `AAAA-MM-DD` → columna `date` (medianoche UTC, como la guarda Prisma). */
export const toDbDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

/** Acceso a `savings_goals` (spec 005, data-model.md). Dueño: módulo savings. */
export const savingsRepository = {
  create(db: Db, goal: NewGoal): Promise<SavingsGoal> {
    return db.savingsGoal.create({
      data: {
        userId: goal.userId,
        accountId: goal.accountId,
        name: goal.name,
        targetAmount: BigInt(goal.targetAmount),
        targetDate: goal.targetDate ? toDbDate(goal.targetDate) : null,
        status: 'active',
        createdAt: goal.now,
        updatedAt: goal.now,
      },
    });
  },

  listByUser(db: Db, userId: string): Promise<SavingsGoal[]> {
    return db.savingsGoal.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  },

  countActive(db: Db, userId: string): Promise<number> {
    return db.savingsGoal.count({ where: { userId, status: 'active' } });
  },

  findOwned(db: Db, userId: string, id: string): Promise<SavingsGoal | null> {
    return db.savingsGoal.findFirst({ where: { id, userId } });
  },

  /** Bloquea la fila (SQL explícito: SELECT … FOR UPDATE, research R4) y la devuelve. */
  async lockOwned(db: Db, userId: string, id: string): Promise<SavingsGoal | null> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM savings_goals WHERE id = ${id}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
    return rows[0] ? db.savingsGoal.findUnique({ where: { id } }) : null;
  },

  update(db: Db, id: string, changes: GoalChanges, now: Date): Promise<SavingsGoal> {
    return db.savingsGoal.update({
      where: { id },
      data: {
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.targetAmount !== undefined
          ? { targetAmount: BigInt(changes.targetAmount) }
          : {}),
        ...(changes.targetDate !== undefined
          ? { targetDate: changes.targetDate === null ? null : toDbDate(changes.targetDate) }
          : {}),
        updatedAt: now,
      },
    });
  },

  /** Cierre (research R6); el trigger impide volver a modificarla. */
  close(db: Db, id: string, closingTransactionId: string | null, now: Date): Promise<SavingsGoal> {
    return db.savingsGoal.update({
      where: { id },
      data: { status: 'closed', closedAt: now, updatedAt: now, closingTransactionId },
    });
  },

  /** Operaciones de devolución de las metas cerradas desde `since` (research R7). */
  async closingTransactionIdsSince(db: Db, userId: string, since: Date): Promise<string[]> {
    const rows = await db.savingsGoal.findMany({
      where: { userId, closedAt: { gte: since }, closingTransactionId: { not: null } },
      select: { closingTransactionId: true },
    });
    return rows.flatMap((r) => (r.closingTransactionId ? [r.closingTransactionId] : []));
  },
};
