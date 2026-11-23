import { type RequestHandler, Router } from 'express';

import type { SavingsController } from './savings.controller.js';

/** Rutas de /api/v1/savings (contrato de la spec 005). */
export function createSavingsRouter(
  controller: SavingsController,
  middleware: { requireAuth: RequestHandler; movementsLimiter: RequestHandler },
): Router {
  const router = Router();
  router.use(middleware.requireAuth);
  router.get('/goals', controller.listMyGoals);
  router.post('/goals', controller.createGoal);
  router.patch('/goals/:goalId', controller.updateGoal);
  router.post('/goals/:goalId/deposits', middleware.movementsLimiter, controller.depositToGoal);
  router.post(
    '/goals/:goalId/withdrawals',
    middleware.movementsLimiter,
    controller.withdrawFromGoal,
  );
  router.post('/goals/:goalId/close', middleware.movementsLimiter, controller.closeGoal);
  router.get('/goals/:goalId/movements', controller.listGoalMovements);
  router.get('/limits', controller.getSavingsLimits);
  return router;
}
