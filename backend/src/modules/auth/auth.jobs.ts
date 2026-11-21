import type { PrismaClient } from '../../lib/db.js';
import type { OutboxWorker } from '../../lib/mail/outbox-worker.js';
import type { Maintenance } from '../../lib/maintenance.js';
import { codeSendRepository } from './repositories/code-send.repository.js';
import { loginAttemptRepository } from './repositories/login-attempt.repository.js';
import { verificationFlowRepository } from './repositories/verification-flow.repository.js';
import type { VerificationService } from './verification.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Registra en el worker y en el mantenimiento lo que pertenece al módulo auth (research R6,
 * Principio VI): el preparador de códigos y la limpieza de sus propias tablas.
 */
export function registerAuthJobs(
  worker: OutboxWorker,
  maintenance: Maintenance,
  deps: { prisma: PrismaClient; verification: VerificationService },
): void {
  worker.registerPreparer('verification_code', deps.verification.prepareCodeEmail);
  worker.registerPreparer('password_reset_code', deps.verification.prepareCodeEmail);

  maintenance.registerCleanup('auth:verification_flows', (now) =>
    verificationFlowRepository.deleteExpiredBefore(deps.prisma, new Date(now.getTime() - DAY_MS)),
  );
  maintenance.registerCleanup('auth:code_sends', (now) =>
    codeSendRepository.deleteBefore(deps.prisma, new Date(now.getTime() - DAY_MS)),
  );
  maintenance.registerCleanup('auth:login_attempts', (now) =>
    loginAttemptRepository.deleteOlderThan(deps.prisma, new Date(now.getTime() - DAY_MS)),
  );
}
