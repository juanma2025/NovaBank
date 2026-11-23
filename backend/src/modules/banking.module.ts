import type { RequestHandler } from 'express';

import { createIdempotencyService } from '../lib/idempotency/idempotency.service.js';
import type { ModuleContext } from '../lib/module-context.js';
import { createAccountsController } from './accounts/accounts.controller.js';
import { createAccountsRouter } from './accounts/accounts.routes.js';
import { createAccountsService } from './accounts/accounts.service.js';
import { createLedgerService } from './ledger/ledger.service.js';
import { createTopupsController } from './topups/topups.controller.js';
import { createTopupsRouter } from './topups/topups.routes.js';
import { createTopupsService } from './topups/topups.service.js';

/**
 * Composición de los módulos de la spec 002 (accounts, ledger, topups) y sus routers.
 * Cada módulo usa solo los servicios públicos de los demás (Principio VI).
 */
export function createBankingModules(
  ctx: ModuleContext,
  middleware: { requireAuth: RequestHandler; topupsLimiter: RequestHandler },
) {
  const accounts = createAccountsService(ctx);
  const ledger = createLedgerService(ctx, { accounts });
  const idempotency = createIdempotencyService(ctx.clock);
  const topups = createTopupsService(ctx, { accounts, ledger, idempotency });

  const accountsRouter = createAccountsRouter(
    createAccountsController({ prisma: ctx.prisma, accounts, ledger }),
    middleware.requireAuth,
  );
  const topupsRouter = createTopupsRouter(createTopupsController({ topups }), {
    requireAuth: middleware.requireAuth,
    limiter: middleware.topupsLimiter,
  });

  return { accounts, ledger, idempotency, topups, accountsRouter, topupsRouter };
}

export type BankingModules = ReturnType<typeof createBankingModules>;
