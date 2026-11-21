import type { AuditEventType, Prisma } from '@nova/db';
import { normalizeEmail } from '@nova/shared';

import type { Clock } from '../clock.js';
import { sha256Hex } from '../crypto.js';
import type { Db } from '../db.js';
import { auditRepository } from './audit.repository.js';

const FORBIDDEN_METADATA_KEYS = /password|code|token|secret/i;

export interface AuditInput {
  userId?: string | null;
  email?: string | null;
  requestId: string;
  metadata?: Prisma.InputJsonObject;
}

export interface AuditService {
  record(db: Db, type: AuditEventType, input: AuditInput): Promise<void>;
}

/**
 * Auditoría de eventos de seguridad (FR-021). Guarda el correo solo como hash
 * (data-model.md `AuditEvent.email_hash`) y rechaza metadatos sensibles (`AuditEvent.metadata`).
 */
export function createAuditService(clock: Clock): AuditService {
  return {
    async record(db, type, { userId = null, email = null, requestId, metadata = {} }) {
      const forbidden = Object.keys(metadata).find((k) => FORBIDDEN_METADATA_KEYS.test(k));
      if (forbidden) throw new Error(`audit metadata no puede incluir «${forbidden}»`);
      await auditRepository.insert(db, {
        type,
        userId,
        emailHash: email ? sha256Hex(normalizeEmail(email)) : null,
        requestId,
        metadata,
        createdAt: clock.now(),
      });
    },
  };
}
