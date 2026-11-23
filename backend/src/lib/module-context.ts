import type { AppConfig } from '../config/env.js';
import type { AuditService } from './audit/audit.service.js';
import type { Clock } from './clock.js';
import type { PrismaClient } from './db.js';
import type { Logger } from './logger.js';

/** Dependencias comunes de los módulos de negocio (inyección para pruebas). */
export interface ModuleContext {
  config: AppConfig;
  prisma: PrismaClient;
  clock: Clock;
  audit: AuditService;
  logger: Logger;
}
