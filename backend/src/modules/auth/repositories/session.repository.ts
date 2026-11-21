import type { Session, SessionEndReason } from '@nova/db';

import type { Db } from '../../../lib/db.js';

/** Acceso a `sessions` (data-model.md `Session`). */
export const sessionRepository = {
  create(
    db: Db,
    data: { userId: string; refreshTokenHash: string; now: Date; absoluteExpiresAt: Date },
  ): Promise<Session> {
    return db.session.create({
      data: {
        userId: data.userId,
        refreshTokenHash: data.refreshTokenHash,
        createdAt: data.now,
        lastActivityAt: data.now,
        absoluteExpiresAt: data.absoluteExpiresAt,
      },
    });
  },

  findById(db: Db, id: string): Promise<Session | null> {
    return db.session.findUnique({ where: { id } });
  },

  findByRefreshHash(db: Db, refreshTokenHash: string): Promise<Session | null> {
    return db.session.findUnique({ where: { refreshTokenHash } });
  },

  findByPreviousRefreshHash(db: Db, previousRefreshTokenHash: string): Promise<Session | null> {
    return db.session.findFirst({ where: { previousRefreshTokenHash } });
  },

  /**
   * Rota el refresh token solo si sigue siendo el vigente (evita dos rotaciones simultáneas).
   * Devuelve si rotó (research R2).
   */
  async rotate(
    db: Db,
    id: string,
    currentHash: string,
    nextHash: string,
    now: Date,
  ): Promise<boolean> {
    const result = await db.session.updateMany({
      where: { id, refreshTokenHash: currentHash, revokedAt: null },
      data: {
        refreshTokenHash: nextHash,
        previousRefreshTokenHash: currentHash,
        rotatedAt: now,
        lastActivityAt: now,
      },
    });
    return result.count > 0;
  },

  async touch(db: Db, id: string, now: Date): Promise<void> {
    await db.session.update({ where: { id }, data: { lastActivityAt: now } });
  },

  /** Revoca solo si sigue activa; devuelve si la revocó (para auditar una sola vez). */
  async revoke(db: Db, id: string, reason: SessionEndReason, now: Date): Promise<boolean> {
    const result = await db.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
    return result.count > 0;
  },

  async revokeAllForUser(
    db: Db,
    userId: string,
    reason: SessionEndReason,
    now: Date,
  ): Promise<string[]> {
    const active = await db.session.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });
    await db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
    return active.map((s) => s.id);
  },
};
