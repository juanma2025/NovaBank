import { createPrismaClient } from '@nova/db';

import { createApp } from '../../src/app.js';
import { type AppConfig, loadConfig } from '../../src/config/env.js';
import { createLogger, type Logger } from '../../src/lib/logger.js';
import { OutboxWorker } from '../../src/lib/mail/outbox-worker.js';
import { Maintenance } from '../../src/lib/maintenance.js';
import { registerAuthJobs } from '../../src/modules/auth/auth.jobs.js';
import { TestAgent } from './agent.js';
import { FakeClock } from './fake-clock.js';
import { MemoryMailProvider } from './memory-mail-provider.js';

/** Aplicación completa con reloj falso, correo en memoria y el worker listo para entregar. */
export function createTestApp(
  overrides: Partial<NodeJS.ProcessEnv> = {},
  options: { logger?: Logger } = {},
) {
  const config: AppConfig = loadConfig({ ...process.env, ...overrides });
  const prisma = createPrismaClient(config.DATABASE_URL);
  const clock = new FakeClock();
  const mail = new MemoryMailProvider();
  const logger = options.logger ?? createLogger('silent');
  const { app, auth } = createApp({ config, prisma, logger, clock, rateLimits: false });
  const worker = new OutboxWorker(prisma, mail, clock, logger);
  const maintenance = new Maintenance(clock, logger);
  registerAuthJobs(worker, maintenance, { prisma, verification: auth.verification });

  return {
    app,
    auth,
    config,
    prisma,
    clock,
    mail,
    worker,
    maintenance,
    agent: () => new TestAgent(app),
    /** Entrega los correos pendientes, como haría el worker cada 2 s. */
    deliverEmails: () => worker.processBatch(),
    close: () => prisma.$disconnect(),
  };
}

export type TestApp = ReturnType<typeof createTestApp>;
