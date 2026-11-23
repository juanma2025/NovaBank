import { type RequestHandler, Router } from 'express';

import type { TopupsController } from './topups.controller.js';

/** Rutas de /api/v1/topups (contrato de la spec 002). */
export function createTopupsRouter(
  controller: TopupsController,
  middleware: { requireAuth: RequestHandler; limiter: RequestHandler },
): Router {
  const router = Router();
  router.use(middleware.requireAuth);
  router.get('/limits', controller.getTopupLimits);
  router.post('/', middleware.limiter, controller.createTopup);
  return router;
}
