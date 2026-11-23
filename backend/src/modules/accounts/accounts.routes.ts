import { type RequestHandler, Router } from 'express';

import type { AccountsController } from './accounts.controller.js';

/** Rutas de /api/v1/accounts (contrato de la spec 002). */
export function createAccountsRouter(
  controller: AccountsController,
  requireAuth: RequestHandler,
): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/me', controller.getMyAccount);
  router.get('/me/movements', controller.listMyMovements);
  return router;
}
