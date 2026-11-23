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

  /** Ajusta el saldo materializado, solo en cuentas de estudiantes (research R3). */
  async incrementStudentBalance(db: Db, id: string, delta: bigint): Promise<void> {
    await db.account.updateMany({
      where: { id, kind: 'student' },
      data: { balance: { increment: delta } },
    });
  },

  findSystemTopups(db: Db): Promise<Account | null> {
    return db.account.findFirst({ where: { kind: 'system_topups' } });
  },
};
