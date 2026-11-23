import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import type { AppConfig } from './config/env.js';
import { createAuditService } from './lib/audit/audit.service.js';
import type { Clock } from './lib/clock.js';
import type { PrismaClient } from './lib/db.js';
import type { Logger } from './lib/logger.js';
import { apiNotFound, createErrorHandler } from './middleware/error-handler.js';
import { createLimiters } from './middleware/rate-limit/limiters.js';
import { requestId } from './middleware/request-id.js';
import { createRequireAuth } from './middleware/require-auth.js';
import { requireJson } from './middleware/require-json.js';
import { type AuthModule, createAuthModule } from './modules/auth/auth.module.js';
import { type BankingModules, createBankingModules } from './modules/banking.module.js';
import { buildOpenApiDocument } from './openapi/registry.js';
import { serveFrontend } from './static.js';

export interface AppDeps {
  config: AppConfig;
  prisma: PrismaClient;
  logger: Logger;
  clock: Clock;
  /** Límites por IP; las pruebas los desactivan para no depender del orden de ejecución. */
  rateLimits?: boolean;
}

export interface NovaApp {
  app: Express;
  auth: AuthModule;
  banking: BankingModules;
}

/** Fábrica de la aplicación (sin listen, para Supertest). Orden del pipeline según plan.md. */
export function createApp(deps: AppDeps): NovaApp {
  const { config, prisma, logger, clock } = deps;
  const app = express();
  app.set('trust proxy', config.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      quietReqLogger: true,
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: config.APP_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use(requireJson);

  const audit = createAuditService(clock);
  const limiters = createLimiters(prisma, clock, { enabled: deps.rateLimits ?? true });
  const auth = createAuthModule({ config, prisma, clock, audit, logger }, limiters);
  const banking = createBankingModules(
    { config, prisma, clock, audit, logger },
    {
      requireAuth: createRequireAuth(auth.sessions),
      topupsLimiter: limiters.topups,
      recipientLookupLimiter: limiters.recipientLookup,
      transfersLimiter: limiters.transfers,
      cardIssueLimiter: limiters.cardIssue,
      cardRevealLimiter: limiters.cardReveal,
      storePaymentsLimiter: limiters.storePayments,
      savingsMovementsLimiter: limiters.savingsMovements,
    },
    { directory: auth.directory, reauth: auth.reauth },
  );
  const openApiDocument = buildOpenApiDocument();

  const api = Router();
  api.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  api.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  api.use('/auth', auth.router);
  api.use('/accounts', banking.accountsRouter);
  api.use('/topups', banking.topupsRouter);
  api.use('/profile', banking.profileRouter);
  api.use('/transfers', banking.transfersRouter);
  api.use('/cards', banking.cardsRouter);
  api.use('/store', banking.storeRouter);
  api.use('/savings', banking.savingsRouter);
  api.use('/budgets', banking.budgetsRouter);
  api.use(apiNotFound);
  app.use('/api/v1', api);
  app.use('/api', apiNotFound);

  if (config.SERVE_FRONTEND) serveFrontend(app);

  app.use(createErrorHandler(logger));
  return { app, auth, banking };
}
