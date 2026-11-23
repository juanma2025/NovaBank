import { MovementsQuerySchema, RECENT_MOVEMENTS, type AccountSummary } from '@nova/shared';
import type { Request, Response } from 'express';

import type { PrismaClient } from '../../lib/db.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { AccountsService } from './accounts.service.js';

export function authUserId(req: Request): string {
  if (!req.auth) throw new Error('require-auth debe ir antes de esta ruta');
  return req.auth.userId;
}

/**
 * Controlador de cuentas (spec 002). Solo `/me`: un estudiante nunca recibe ni envía ids de
 * cuentas, así que no puede ver las de otro (FR-004).
 */
export function createAccountsController(deps: {
  prisma: PrismaClient;
  accounts: AccountsService;
  ledger: LedgerService;
}) {
  const { prisma, accounts, ledger } = deps;

  return {
    /** GET /accounts/me (operación getMyAccount): crea la cuenta si no existe (FR-001). */
    async getMyAccount(req: Request, res: Response): Promise<void> {
      const account = await accounts.ensureForUser(prisma, authUserId(req));
      const body: AccountSummary = {
        id: account.id,
        currency: 'COP',
        balance: account.balance,
        recentMovements: await ledger.recentMovements(prisma, account.id, RECENT_MOVEMENTS),
      };
      res.json(body);
    },

    /** GET /accounts/me/movements (operación listMyMovements): historial por cursor (FR-020). */
    async listMyMovements(req: Request, res: Response): Promise<void> {
      const query = MovementsQuerySchema.parse(req.query);
      const account = await accounts.ensureForUser(prisma, authUserId(req));
      res.json(await ledger.listMovements(prisma, account.id, query));
    },
  };
}

export type AccountsController = ReturnType<typeof createAccountsController>;
