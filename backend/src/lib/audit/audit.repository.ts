import type { AuditEventType, Prisma } from '@nova/db';

import type { Db } from '../db.js';

export interface AuditInsert {
  type: AuditEventType;
  userId: string | null;
  emailHash: string | null;
  requestId: string;
  metadata: Prisma.InputJsonObject;
  createdAt: Date;
}

/** Solo inserta: la tabla es inmutable por triggers (data-model.md `AuditEvent`). */
export const auditRepository = {
  async insert(db: Db, event: AuditInsert): Promise<void> {
    await db.auditEvent.create({ data: event });
  },
};
