import { type RequestHandler, Router } from 'express';

import type { CardsController } from './cards.controller.js';

/** Rutas de /api/v1/cards (contrato de la spec 004). */
export function createCardsRouter(
  controller: CardsController,
  middleware: {
    requireAuth: RequestHandler;
    issueLimiter: RequestHandler;
    revealLimiter: RequestHandler;
  },
): Router {
  const router = Router();
  router.use(middleware.requireAuth);
  router.get('/', controller.listMyCards);
  router.post('/', middleware.issueLimiter, controller.issueCard);
  router.patch('/:cardId', controller.renameCard);
  router.post('/:cardId/freeze', controller.freezeCard);
  router.post('/:cardId/unfreeze', controller.unfreezeCard);
  router.post('/:cardId/cancel', controller.cancelCard);
  router.post('/:cardId/reveal', middleware.revealLimiter, controller.revealCard);
  router.get('/:cardId/payments', controller.listCardPayments);
  return router;
}
