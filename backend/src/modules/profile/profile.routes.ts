import { type RequestHandler, Router } from 'express';

import type { ProfileController } from './profile.controller.js';

/** Rutas de /api/v1/profile (contrato de la spec 003). */
export function createProfileRouter(
  controller: ProfileController,
  requireAuth: RequestHandler,
): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/me', controller.getMyProfile);
  router.put('/me/alias', controller.setMyAlias);
  router.delete('/me/alias', controller.removeMyAlias);
  return router;
}
