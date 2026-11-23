import type { BudgetAlert, BudgetCategory } from '@nova/db';

import type { Db } from '../../lib/db.js';

export interface NewAlert {
  userId: string;
  month: string;
  category: BudgetCategory;
  threshold: 80 | 100;
  spent: number;
  monthlyLimit: number;
  now: Date;
}

/**
 * Acceso a `budget_limits`, `transfer_categories` y `budget_alerts` (spec 006, data-model.md).
 * Dueño: módulo budgets.
 */
export const budgetsRepository = {
  /**
   * Tope vigente de cada categoría en `month`: la versión con el mayor `effective_month ≤ month`
   * (research R4). Las categorías sin versión no aparecen; `null` = tope quitado.
   */
  async limitsFor(
    db: Db,
    userId: string,
    month: string,
  ): Promise<Map<BudgetCategory, bigint | null>> {
    const rows = await db.budgetLimit.findMany({
      where: { userId, effectiveMonth: { lte: month } },
      orderBy: { effectiveMonth: 'desc' },
    });
    const limits = new Map<BudgetCategory, bigint | null>();
    for (const row of rows) {
      if (!limits.has(row.category)) limits.set(row.category, row.monthlyLimit);
    }
    return limits;
  },

  /** Versión del mes actual: crear o reemplazar (`null` quita el tope desde ese mes). */
  async upsertLimit(
    db: Db,
    key: { userId: string; category: BudgetCategory; month: string },
    monthlyLimit: number | null,
    now: Date,
  ): Promise<void> {
    const value = monthlyLimit === null ? null : BigInt(monthlyLimit);
    await db.budgetLimit.upsert({
      where: {
        userId_category_effectiveMonth: {
          userId: key.userId,
          category: key.category,
          effectiveMonth: key.month,
        },
      },
      create: {
        userId: key.userId,
        category: key.category,
        effectiveMonth: key.month,
        monthlyLimit: value,
        updatedAt: now,
      },
      update: { monthlyLimit: value, updatedAt: now },
    });
  },

  async categoriesFor(db: Db, transactionIds: string[]): Promise<Map<string, BudgetCategory>> {
    if (transactionIds.length === 0) return new Map();
    const rows = await db.transferCategory.findMany({
      where: { transactionId: { in: transactionIds } },
    });
    return new Map(rows.map((r) => [r.transactionId, r.category]));
  },

  async upsertCategory(
    db: Db,
    transactionId: string,
    userId: string,
    category: BudgetCategory,
    now: Date,
  ): Promise<void> {
    await db.transferCategory.upsert({
      where: { transactionId },
      create: { transactionId, userId, category, updatedAt: now },
      update: { category, updatedAt: now },
    });
  },

  /**
   * Inserta la alerta solo si no existe para ese umbral, categoría y mes (SQL explícito:
   * ON CONFLICT DO NOTHING, research R5). Devuelve el id si es nueva, o null.
   */
  async insertAlertIfNew(db: Db, alert: NewAlert): Promise<string | null> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      INSERT INTO budget_alerts (user_id, month, category, threshold, spent, monthly_limit, created_at)
      VALUES (${alert.userId}::uuid, ${alert.month}, ${alert.category}::budget_category,
              ${alert.threshold}, ${BigInt(alert.spent)}, ${BigInt(alert.monthlyLimit)}, ${alert.now})
      ON CONFLICT (user_id, month, category, threshold) DO NOTHING
      RETURNING id`;
    return rows[0]?.id ?? null;
  },

  listAlerts(db: Db, userId: string, month: string): Promise<BudgetAlert[]> {
    return db.budgetAlert.findMany({
      where: { userId, month },
      orderBy: [{ createdAt: 'desc' }, { threshold: 'desc' }],
    });
  },

  findAlert(db: Db, userId: string, id: string): Promise<BudgetAlert | null> {
    return db.budgetAlert.findFirst({ where: { id, userId } });
  },

  markSeen(db: Db, id: string, now: Date): Promise<BudgetAlert> {
    return db.budgetAlert.update({ where: { id }, data: { seenAt: now } });
  },
};
