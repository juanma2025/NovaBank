import type { Prisma, VerificationFlow, VerificationPurpose } from '@nova/db';

import type { Db } from '../../../lib/db.js';

/** Acceso a `verification_flows` (data-model.md `VerificationFlow`). */
export const verificationFlowRepository = {
  create(db: Db, data: Prisma.VerificationFlowUncheckedCreateInput): Promise<VerificationFlow> {
    return db.verificationFlow.create({ data });
  },

  findByTokenHash(db: Db, flowTokenHash: string): Promise<VerificationFlow | null> {
    return db.verificationFlow.findUnique({ where: { flowTokenHash } });
  },

  /**
   * Bloquea el flujo para una transición de estado (SQL explícito: FOR UPDATE, plan.md).
   * Evita que dos solicitudes simultáneas consuman el mismo código o superen los intentos.
   */
  async lockByTokenHash(db: Db, flowTokenHash: string): Promise<VerificationFlow | null> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM verification_flows WHERE flow_token_hash = ${flowTokenHash} FOR UPDATE`;
    const id = rows[0]?.id;
    return id ? db.verificationFlow.findUnique({ where: { id } }) : null;
  },

  async lockById(db: Db, id: string): Promise<VerificationFlow | null> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM verification_flows WHERE id = ${id}::uuid FOR UPDATE`;
    return rows[0] ? db.verificationFlow.findUnique({ where: { id } }) : null;
  },

  update(
    db: Db,
    id: string,
    data: Prisma.VerificationFlowUncheckedUpdateInput,
  ): Promise<VerificationFlow> {
    return db.verificationFlow.update({ where: { id }, data });
  },

  /** Marca como `superseded` los flujos activos del mismo correo y propósito. */
  async supersedeActive(db: Db, email: string, purpose: VerificationPurpose): Promise<void> {
    await db.verificationFlow.updateMany({
      where: { email, purpose, status: { in: ['awaiting_code', 'verified'] } },
      data: { status: 'superseded' },
    });
  },

  /** Limpieza de auth: flujos vencidos hace más de 24 h. */
  async deleteExpiredBefore(db: Db, before: Date): Promise<number> {
    const result = await db.verificationFlow.deleteMany({ where: { expiresAt: { lt: before } } });
    return result.count;
  },
};
