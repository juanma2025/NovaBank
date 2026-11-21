import type { Db } from '../../../lib/db.js';

/** Acceso a `login_attempts` (data-model.md `LoginAttempt`). Solo guarda intentos fallidos. */
export const loginAttemptRepository = {
  async insert(db: Db, email: string, originKey: string, now: Date): Promise<void> {
    await db.loginAttempt.create({ data: { email, originKey, createdAt: now } });
  },

  /** Fechas de los `limit` fallos más recientes del correo, opcionalmente de un origen. */
  async latest(db: Db, email: string, limit: number, originKey?: string): Promise<Date[]> {
    const rows = await db.loginAttempt.findMany({
      where: { email, ...(originKey ? { originKey } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { createdAt: true },
    });
    return rows.map((r) => r.createdAt);
  },

  /** Tras un inicio de sesión exitoso: borra los fallos de ese correo y origen. */
  async deleteForOrigin(db: Db, email: string, originKey: string): Promise<void> {
    await db.loginAttempt.deleteMany({ where: { email, originKey } });
  },

  /** Al recuperar la contraseña: borra todos los fallos del correo (FR-020c). */
  async deleteByEmail(db: Db, email: string): Promise<void> {
    await db.loginAttempt.deleteMany({ where: { email } });
  },

  /** Limpieza de auth: fallos de más de 24 h. */
  async deleteOlderThan(db: Db, before: Date): Promise<number> {
    const result = await db.loginAttempt.deleteMany({ where: { createdAt: { lt: before } } });
    return result.count;
  },
};
