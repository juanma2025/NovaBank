import { type RequestHandler, Router } from 'express';

import type { TransfersController } from './transfers.controller.js';

/** Rutas de /api/v1/transfers (contrato de la spec 003). */
export function createTransfersRouter(
  controller: TransfersController,
  middleware: {
    requireAuth: RequestHandler;
    recipientLookupLimiter: RequestHandler;
    transfersLimiter: RequestHandler;
  },
): Router {
  const router = Router();
  router.use(middleware.requireAuth);
  router.get('/recipient', middleware.recipientLookupLimiter, controller.findRecipient);
  router.get('/limits', controller.getTransferLimits);
  router.post('/', middleware.transfersLimiter, controller.createTransfer);
  return router;
}
