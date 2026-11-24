import { createPrismaClient } from '@nova/db';

import { createApp } from './app.js';
import { EnvValidationError, loadConfig } from './config/env.js';
import { systemClock } from './lib/clock.js';
import { createLogger } from './lib/logger.js';
import { OutboxWorker } from './lib/mail/outbox-worker.js';
import { outboxRepository } from './lib/mail/outbox.repository.js';
import { createSmtpProvider } from './lib/mail/smtp-provider.js';
import { Maintenance } from './lib/maintenance.js';
import { PgRateLimitStore } from './middleware/rate-limit/pg-store.js';
import { registerAuthJobs } from './modules/auth/auth.jobs.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function start(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const logger = createLogger(config.LOG_LEVEL);
  const prisma = createPrismaClient(config.DATABASE_URL);
  const clock = systemClock;
  const { app, auth, banking } = createApp({
    config,
    prisma,
    logger,
    clock,
    rateLimits: config.RATE_LIMITS_ENABLED,
  });

  // Registro de preparadores y limpiezas de cada dueño antes de arrancar (research R6).
  const worker = new OutboxWorker(prisma, createSmtpProvider(config), clock, logger);
  const maintenance = new Maintenance(clock, logger);
  registerAuthJobs(worker, maintenance, { prisma, verification: auth.verification });
  banking.idempotency.registerCleanup(maintenance, prisma);
  maintenance.registerCleanup('cards:card_payment_declines', (now) =>
    banking.payments.deleteOldDeclines(now),
  );
  maintenance.registerCleanup('rate_limit_hits', (now) =>
    PgRateLimitStore.cleanupExpired(prisma, now),
  );
  maintenance.registerCleanup('email_outbox', (now) =>
    outboxRepository.deleteFinishedBefore(prisma, new Date(now.getTime() - WEEK_MS)),
  );

  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, `API de Nova escuchando en http://localhost:${config.PORT}`);
  });
  worker.start();
  maintenance.start();

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'cerrando');
    worker.stop();
    maintenance.stop();
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
