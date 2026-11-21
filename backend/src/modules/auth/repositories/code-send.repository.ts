import type { VerificationPurpose } from '@nova/db';

import type { Db } from '../../../lib/db.js';

const HOUR_MS = 60 * 60 * 1000;

/** Acceso a `code_sends` (data-model.md `CodeSend`): límite de 5 códigos por correo y hora. */
export const codeSendRepository = {
  async insert(db: Db, email: string, purpose: VerificationPurpose, now: Date): Promise<void> {
    await db.codeSend.create({ data: { email, purpose, createdAt: now } });
  },

  /** Envíos del correo en la última hora, sumando todos los propósitos (FR-005). */
  async lastHour(db: Db, email: string, now: Date): Promise<Date[]> {
    const rows = await db.codeSend.findMany({
      where: { email, createdAt: { gt: new Date(now.getTime() - HOUR_MS) } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    return rows.map((r) => r.createdAt);
  },

  async deleteBefore(db: Db, before: Date): Promise<number> {
    const result = await db.codeSend.deleteMany({ where: { createdAt: { lt: before } } });
    return result.count;
  },
};
