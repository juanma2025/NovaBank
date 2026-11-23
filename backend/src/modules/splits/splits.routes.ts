import { type RequestHandler, Router } from 'express';

import type { SplitsController } from './splits.controller.js';

/** Rutas de /api/v1/splits (contrato de la spec 007). */
export function createSplitsRouter(
  controller: SplitsController,
  middleware: {
    requireAuth: RequestHandler;
    createLimiter: RequestHandler;
    paymentsLimiter: RequestHandler;
  },
): Router {
  const router = Router();
  router.use(middleware.requireAuth);
  router.get('/', controller.listMySplits);
  router.post('/', middleware.createLimiter, controller.createSplit);
  // Antes de /:splitId para que «summary» no se lea como un id.
  router.get('/summary', controller.getSplitsSummary);
  router.get('/:splitId', controller.getSplit);
  router.post('/:splitId/cancel', controller.cancelSplit);
  // El pago es una transferencia: comparte su límite de tasa (spec 003).
  router.post('/:splitId/shares/me/pay', middleware.paymentsLimiter, controller.paySplitShare);
  router.post('/:splitId/shares/me/decline', controller.declineSplitShare);
  router.post('/:splitId/shares/:shareId/mark-paid', controller.markSplitSharePaid);
  router.post('/:splitId/shares/:shareId/remind', controller.remindSplitShare);
  return router;
}
