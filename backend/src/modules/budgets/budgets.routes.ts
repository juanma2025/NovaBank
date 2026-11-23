import { type RequestHandler, Router } from 'express';

import type { BudgetsController } from './budgets.controller.js';

/** Rutas de /api/v1/budgets (contrato de la spec 006). */
export function createBudgetsRouter(
  controller: BudgetsController,
  requireAuth: RequestHandler,
): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/', controller.getBudgetMonth);
  router.put('/limits/:category', controller.setBudgetLimit);
  router.delete('/limits/:category', controller.removeBudgetLimit);
  router.get('/alerts', controller.listBudgetAlerts);
  router.post('/alerts/:alertId/seen', controller.markBudgetAlertSeen);
  router.get('/transfers', controller.listBudgetTransfers);
  router.put('/transfers/:transactionId/category', controller.setTransferCategory);
  return router;
}
