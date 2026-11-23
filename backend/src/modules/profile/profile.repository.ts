import type { Profile } from '@nova/db';

import type { Db } from '../../lib/db.js';

/** Acceso a `profiles` (spec 003, data-model.md `Profile`). Dueño: módulo profile. */
export const profileRepository = {
  findByUserId(db: Db, userId: string): Promise<Profile | null> {
    return db.profile.findUnique({ where: { userId } });
  },

  findByAlias(db: Db, alias: string): Promise<Profile | null> {
    return db.profile.findUnique({ where: { alias } });
  },

  /**
   * Asigna el alias; crea la fila si no existe (INSERT … ON CONFLICT en la base). Si otro estudiante
   * ya lo tiene, el índice único de data-model.md `Profile.alias` lanza P2002.
   */
  async upsertAlias(db: Db, userId: string, alias: string, now: Date): Promise<void> {
    await db.profile.upsert({
      where: { userId },
      create: { userId, alias, updatedAt: now },
      update: { alias, updatedAt: now },
    });
  },

  /** Quita el alias (`alias = NULL`); el valor anterior queda libre (FR-017). */
  async clearAlias(db: Db, userId: string, now: Date): Promise<void> {
    await db.profile.updateMany({ where: { userId }, data: { alias: null, updatedAt: now } });
  },
};
