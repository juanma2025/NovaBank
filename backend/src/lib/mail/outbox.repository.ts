import type { EmailTemplate, Prisma } from '@nova/db';

import type { Db } from '../db.js';

export interface OutboxRow {
  id: string;
  to_email: string;
  template: EmailTemplate;
  verification_flow_id: string | null;
  payload: Prisma.JsonValue;
  attempts: number;
  created_at: Date;
}

export interface EnqueueInput {
  template: EmailTemplate;
  to: string;
  flowId?: string;
  payload?: Prisma.InputJsonObject;
  now: Date;
}

const FORBIDDEN_PAYLOAD_KEYS = /password|code|token|secret/i;

/** Acceso a `email_outbox` (data-model.md `EmailOutbox`). Solo lo usa `lib/mail`. */
export const outboxRepository = {
  /** Encola un correo en la transacción de negocio. El payload nunca lleva secretos (R6). */
  async enqueue(db: Db, { template, to, flowId, payload = {}, now }: EnqueueInput): Promise<void> {
    const forbidden = Object.keys(payload).find((k) => FORBIDDEN_PAYLOAD_KEYS.test(k));
    if (forbidden) throw new Error(`email_outbox.payload no puede incluir «${forbidden}»`);
    await db.emailOutbox.create({
      data: {
        toEmail: to,
        template,
        verificationFlowId: flowId ?? null,
        payload,
        status: 'pending',
        nextAttemptAt: now,
        createdAt: now,
      },
    });
  },

  /** Descarta los correos de código pendientes de un flujo (al pedir uno nuevo, M1). */
  async discardPendingCodeEmails(db: Db, flowId: string): Promise<void> {
    await db.emailOutbox.updateMany({
      where: { verificationFlowId: flowId, status: 'pending' },
      data: { status: 'discarded' },
    });
  },

  /** Toma una fila lista para enviar y la bloquea (SQL explícito: SKIP LOCKED, plan.md). */
  async claimNext(db: Db, now: Date): Promise<OutboxRow | null> {
    const rows = await db.$queryRaw<OutboxRow[]>`
      SELECT id, to_email, template, verification_flow_id, payload, attempts, created_at
      FROM email_outbox
      WHERE status = 'pending' AND next_attempt_at <= ${now}
      ORDER BY next_attempt_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
    return rows[0] ?? null;
  },

  async markSent(db: Db, id: string, now: Date): Promise<void> {
    await db.emailOutbox.update({ where: { id }, data: { status: 'sent', sentAt: now } });
  },

  async markDiscarded(db: Db, id: string): Promise<void> {
    await db.emailOutbox.update({ where: { id }, data: { status: 'discarded' } });
  },

  async markRetry(
    db: Db,
    id: string,
    attempts: number,
    nextAttemptAt: Date | null,
    lastError: string,
  ): Promise<void> {
    await db.emailOutbox.update({
      where: { id },
      data: nextAttemptAt
        ? { attempts, nextAttemptAt, lastError }
        : { attempts, lastError, status: 'failed' },
    });
  },

  /** Limpieza propia de lib/mail: filas terminadas de más de 7 días. */
  async deleteFinishedBefore(db: Db, before: Date): Promise<number> {
    const result = await db.emailOutbox.deleteMany({
      where: { status: { in: ['sent', 'failed', 'discarded'] }, createdAt: { lt: before } },
    });
    return result.count;
  },
};
