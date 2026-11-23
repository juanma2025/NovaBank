import type { IdempotencyKey, Prisma } from '@nova/db';

import type { Db } from '../db.js';

/** Acceso a `idempotency_keys` (spec 002, data-model.md `IdempotencyKey`). Dueño: lib/idempotency. */
export const idempotencyRepository = {
  /**
   * Inserta la clave si es nueva (SQL explícito: INSERT … ON CONFLICT DO NOTHING RETURNING). Si
   * otra transacción insertó la misma clave y aún no confirma, PostgreSQL espera a que termine.
   */
  async insertIfNew(
    db: Db,
    data: {
      userId: string;
      scope: string;
      key: string;
      requestHash: string;
      now: Date;
      expiresAt: Date;
    },
  ): Promise<string | null> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      INSERT INTO idempotency_keys (user_id, scope, key, request_hash, created_at, expires_at)
      VALUES (${data.userId}::uuid, ${data.scope}, ${data.key}, ${data.requestHash}, ${data.now}, ${data.expiresAt})
      ON CONFLICT (user_id, scope, key) DO NOTHING
      RETURNING id`;
    return rows[0]?.id ?? null;
  },

  find(db: Db, userId: string, scope: string, key: string): Promise<IdempotencyKey | null> {
    return db.idempotencyKey.findUnique({ where: { userId_scope_key: { userId, scope, key } } });
  },

  async saveResponse(
    db: Db,
    id: string,
    status: number,
    body: Prisma.InputJsonValue,
  ): Promise<void> {
    await db.idempotencyKey.update({
      where: { id },
      data: { responseStatus: status, responseBody: body },
    });
  },

  async deleteExpired(db: Db, now: Date): Promise<number> {
    const result = await db.idempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } });
    return result.count;
  },
};
