import { type RequestHandler, Router } from 'express';

import type { StoreController } from './store.controller.js';

/** Rutas de /api/v1/store (contrato de la spec 004). */
export function createStoreRouter(
  controller: StoreController,
  middleware: { requireAuth: RequestHandler; paymentsLimiter: RequestHandler },
): Router {
  const router = Router();
  router.use(middleware.requireAuth);
  router.get('/limits', controller.getPaymentLimits);
  router.post('/payments', middleware.paymentsLimiter, controller.createCardPayment);
  return router;
}
