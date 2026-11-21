import type { AppConfig } from '../../config/env.js';
import type { AuditService } from '../../lib/audit/audit.service.js';
import type { Clock } from '../../lib/clock.js';
import type { PrismaClient } from '../../lib/db.js';
import type { Logger } from '../../lib/logger.js';

/** Dependencias que reciben los servicios del módulo auth (inyección para pruebas). */
export interface AuthContext {
  config: AppConfig;
  prisma: PrismaClient;
  clock: Clock;
  audit: AuditService;
  logger: Logger;
}
