import type { RequestHandler } from 'express';

import { createCardCrypto } from '../lib/card-crypto.js';
import { createEventBus } from '../lib/events.js';
import { createIdempotencyService } from '../lib/idempotency/idempotency.service.js';
import type { ModuleContext } from '../lib/module-context.js';
import { createAccountsController } from './accounts/accounts.controller.js';
import { createAccountsRouter } from './accounts/accounts.routes.js';
import { createAccountsService } from './accounts/accounts.service.js';
import type { AuthDirectory } from './auth/auth.directory.js';
import type { ReauthService } from './auth/reauth.service.js';
import { createBudgetsController } from './budgets/budgets.controller.js';
import { createBudgetsRouter } from './budgets/budgets.routes.js';
import { createBudgetsService } from './budgets/budgets.service.js';
import { createCardsController } from './cards/cards.controller.js';
import { createCardsRouter } from './cards/cards.routes.js';
import { createCardsService } from './cards/cards.service.js';
import { createPaymentsService } from './cards/payments.service.js';
import { createStoreController } from './cards/store.controller.js';
import { createStoreRouter } from './cards/store.routes.js';
import { createLedgerService } from './ledger/ledger.service.js';
import { createProfileController } from './profile/profile.controller.js';
import { createProfileRouter } from './profile/profile.routes.js';
import { createProfileService } from './profile/profile.service.js';
import { createSavingsController } from './savings/savings.controller.js';
import { createSavingsRouter } from './savings/savings.routes.js';
import { createSavingsService } from './savings/savings.service.js';
import { createSplitsController } from './splits/splits.controller.js';
import { createSplitsRouter } from './splits/splits.routes.js';
import { createSplitsService } from './splits/splits.service.js';
import { createTopupsController } from './topups/topups.controller.js';
import { createTopupsRouter } from './topups/topups.routes.js';
import { createTopupsService } from './topups/topups.service.js';
import { createTransfersController } from './transfers/transfers.controller.js';
import { createTransfersRouter } from './transfers/transfers.routes.js';
import { createTransfersService } from './transfers/transfers.service.js';

/**
 * Composición de los módulos de dinero y perfil: accounts, ledger, topups (spec 002), profile y
 * transfers (spec 003), cards (spec 004), savings (spec 005), budgets (spec 006) y splits
 * (spec 007), con sus
 * routers. El bus de eventos avisa a budgets de cada gasto confirmado (spec 006, research R2). Cada módulo usa solo los servicios públicos de los demás
 * (Principio VI); de auth reciben el directorio y la reautenticación.
 */
export function createBankingModules(
  ctx: ModuleContext,
  middleware: {
    requireAuth: RequestHandler;
    topupsLimiter: RequestHandler;
    recipientLookupLimiter: RequestHandler;
    transfersLimiter: RequestHandler;
    cardIssueLimiter: RequestHandler;
    cardRevealLimiter: RequestHandler;
    storePaymentsLimiter: RequestHandler;
    savingsMovementsLimiter: RequestHandler;
    splitCreateLimiter: RequestHandler;
  },
  auth: { directory: AuthDirectory; reauth: ReauthService },
) {
  const accounts = createAccountsService(ctx);
  const ledger = createLedgerService(ctx, { accounts });
  const idempotency = createIdempotencyService(ctx.clock);
  const events = createEventBus(ctx.logger);
  const topups = createTopupsService(ctx, { accounts, ledger, idempotency });
  const profile = createProfileService(ctx, { directory: auth.directory });
  const transfers = createTransfersService(ctx, {
    accounts,
    ledger,
    idempotency,
    directory: auth.directory,
    reauth: auth.reauth,
    profile,
    events,
  });
  const cardCrypto = createCardCrypto(ctx.config.CARD_ENCRYPTION_KEY);
  const cards = createCardsService(ctx, {
    accounts,
    directory: auth.directory,
    reauth: auth.reauth,
    crypto: cardCrypto,
  });
  const payments = createPaymentsService(ctx, {
    accounts,
    ledger,
    idempotency,
    crypto: cardCrypto,
    events,
  });
  const savings = createSavingsService(ctx, { accounts, ledger, idempotency });
  const budgets = createBudgetsService(ctx, {
    accounts,
    ledger,
    payments,
    directory: auth.directory,
  });
  // Se llama a la propiedad en cada evento (no se captura la función) para poder sustituirla en pruebas.
  events.on('spending.recorded', ({ userId }) => budgets.evaluateCurrentMonth(userId));
  // El pago de una parte es una transferencia normal (regla de dominio 11, spec 007 R2).
  const splits = createSplitsService(ctx, { accounts, transfers, directory: auth.directory });

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

  const cardsRouter = createCardsRouter(createCardsController({ cards, payments }), {
    requireAuth: middleware.requireAuth,
    issueLimiter: middleware.cardIssueLimiter,
    revealLimiter: middleware.cardRevealLimiter,
  });
  const storeRouter = createStoreRouter(createStoreController({ payments }), {
    requireAuth: middleware.requireAuth,
    paymentsLimiter: middleware.storePaymentsLimiter,
  });

  const savingsRouter = createSavingsRouter(createSavingsController({ savings }), {
    requireAuth: middleware.requireAuth,
    movementsLimiter: middleware.savingsMovementsLimiter,
  });

  const budgetsRouter = createBudgetsRouter(
    createBudgetsController({ budgets }),
    middleware.requireAuth,
  );

  const splitsRouter = createSplitsRouter(createSplitsController({ splits }), {
    requireAuth: middleware.requireAuth,
    createLimiter: middleware.splitCreateLimiter,
    paymentsLimiter: middleware.transfersLimiter,
  });

  return {
    accounts,
    ledger,
    idempotency,
    topups,
    profile,
    transfers,
    cards,
    payments,
    savings,
    budgets,
    splits,
    events,
    accountsRouter,
    topupsRouter,
    profileRouter,
    transfersRouter,
    cardsRouter,
    storeRouter,
    savingsRouter,
    budgetsRouter,
    splitsRouter,
  };
}

export type BankingModules = ReturnType<typeof createBankingModules>;
