import type { Account } from '@nova/db';

import type { Db } from '../../lib/db.js';

/** Acceso a `accounts` (spec 002, data-model.md `Account`). Dueño: módulo accounts. */
export const accountsRepository = {
  /**
   * Crea la cuenta del estudiante si no existe (SQL explícito: INSERT … ON CONFLICT), seguro ante
   * solicitudes simultáneas (research R6).
   */
  async insertStudentIfMissing(db: Db, userId: string, now: Date): Promise<void> {
    await db.$executeRaw`
      INSERT INTO accounts (kind, user_id, currency, balance, status, created_at)
      VALUES ('student', ${userId}::uuid, 'COP', 0, 'active', ${now})
      ON CONFLICT (user_id) DO NOTHING`;
  },

  findByUserId(db: Db, userId: string): Promise<Account | null> {
    return db.account.findUnique({ where: { userId } });
  },

  /** Bloquea la fila (SQL explícito: SELECT … FOR UPDATE, research R4) y la devuelve. */
  async lockById(db: Db, id: string): Promise<Account | null> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM accounts WHERE id = ${id}::uuid FOR UPDATE`;
    return rows[0] ? db.account.findUnique({ where: { id } }) : null;
  },

  /**
   * Bloquea varias filas en orden ascendente de id (spec 003, research R6): dos transferencias
   * cruzadas bloquean primero la misma cuenta y no se produce un deadlock.
   */
  async lockManyById(db: Db, ids: string[]): Promise<Account[]> {
    const sorted = [...new Set(ids)].sort();
    for (const id of sorted) {
      await db.$queryRaw`SELECT id FROM accounts WHERE id = ${id}::uuid FOR UPDATE`;
    }
    return db.account.findMany({ where: { id: { in: sorted } } });
  },

  findStudentById(db: Db, id: string): Promise<Account | null> {
    return db.account.findFirst({ where: { id, kind: 'student' } });
  },

  /**
   * Ajusta el saldo materializado: cuentas de estudiantes (spec 002, research R3) y subcuentas de
   * metas (spec 005, research R2). Las cuentas del sistema no tienen saldo materializado.
   */
  async incrementMaterializedBalance(db: Db, id: string, delta: bigint): Promise<void> {
    await db.account.updateMany({
      where: { id, kind: { in: ['student', 'savings_goal'] } },
      data: { balance: { increment: delta } },
    });
  },

  /** Spec 005: subcuenta de una meta, sin user_id (research R2). */
  createSavingsGoal(db: Db, now: Date): Promise<Account> {
    return db.account.create({
      data: {
        kind: 'savings_goal',
        currency: 'COP',
        balance: 0n,
        status: 'active',
        createdAt: now,
      },
    });
  },

  findManyByIds(db: Db, ids: string[]): Promise<Account[]> {
    return db.account.findMany({ where: { id: { in: ids } } });
  },

  findSystemTopups(db: Db): Promise<Account | null> {
    return db.account.findFirst({ where: { kind: 'system_topups' } });
  },

  /** Spec 004: cuenta técnica de los comercios simulados (research R5). */
  findSystemMerchants(db: Db): Promise<Account | null> {
    return db.account.findFirst({ where: { kind: 'system_merchants' } });
  },
};
