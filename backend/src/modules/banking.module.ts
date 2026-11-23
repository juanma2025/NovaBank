import type { RequestHandler } from 'express';

import { createIdempotencyService } from '../lib/idempotency/idempotency.service.js';
import type { ModuleContext } from '../lib/module-context.js';
import { createAccountsController } from './accounts/accounts.controller.js';
import { createAccountsRouter } from './accounts/accounts.routes.js';
import { createAccountsService } from './accounts/accounts.service.js';
import type { AuthDirectory } from './auth/auth.directory.js';
import type { ReauthService } from './auth/reauth.service.js';
import { createLedgerService } from './ledger/ledger.service.js';
import { createProfileController } from './profile/profile.controller.js';
import { createProfileRouter } from './profile/profile.routes.js';
import { createProfileService } from './profile/profile.service.js';
import { createTopupsController } from './topups/topups.controller.js';
import { createTopupsRouter } from './topups/topups.routes.js';
import { createTopupsService } from './topups/topups.service.js';
import { createTransfersController } from './transfers/transfers.controller.js';
import { createTransfersRouter } from './transfers/transfers.routes.js';
import { createTransfersService } from './transfers/transfers.service.js';

/**
 * Composición de los módulos de dinero y perfil: accounts, ledger, topups (spec 002), profile y
 * transfers (spec 003), con sus routers. Cada módulo usa solo los servicios públicos de los demás
 * (Principio VI); de auth reciben el directorio y la reautenticación.
 */
export function createBankingModules(
  ctx: ModuleContext,
  middleware: {
    requireAuth: RequestHandler;
    topupsLimiter: RequestHandler;
    recipientLookupLimiter: RequestHandler;
    transfersLimiter: RequestHandler;
  },
  auth: { directory: AuthDirectory; reauth: ReauthService },
) {
  const accounts = createAccountsService(ctx);
  const ledger = createLedgerService(ctx, { accounts });
  const idempotency = createIdempotencyService(ctx.clock);
  const topups = createTopupsService(ctx, { accounts, ledger, idempotency });
  const profile = createProfileService(ctx, { directory: auth.directory });
  const transfers = createTransfersService(ctx, {
    accounts,
    ledger,
    idempotency,
    directory: auth.directory,
    reauth: auth.reauth,
    profile,
  });

  const accountsRouter = createAccountsRouter(
    createAccountsController({ prisma: ctx.prisma, accounts, ledger }),
    middleware.requireAuth,
  );
  const topupsRouter = createTopupsRouter(createTopupsController({ topups }), {
    requireAuth: middleware.requireAuth,
    limiter: middleware.topupsLimiter,
  });

  const profileRouter = createProfileRouter(
    createProfileController({ profile }),
    middleware.requireAuth,
  );
  const transfersRouter = createTransfersRouter(createTransfersController({ transfers }), {
    requireAuth: middleware.requireAuth,
    recipientLookupLimiter: middleware.recipientLookupLimiter,
    transfersLimiter: middleware.transfersLimiter,
  });

  return {
    accounts,
    ledger,
    idempotency,
    topups,
    profile,
    transfers,
    accountsRouter,
    topupsRouter,
    profileRouter,
    transfersRouter,
  };
}

export type BankingModules = ReturnType<typeof createBankingModules>;
