import { Router } from 'express';

import { createRequireAuth } from '../../middleware/require-auth.js';
import type { Limiters } from '../../middleware/rate-limit/limiters.js';
import type { AuthController } from './auth.controller.js';
import type { SessionService } from './session.service.js';

/** Rutas de /api/v1/auth (contrato de la spec 001). Express 5 propaga los errores async. */
export function createAuthRouter(
  controller: AuthController,
  sessions: SessionService,
  limiters: Limiters,
): Router {
  const router = Router();
  const requireAuth = createRequireAuth(sessions);

  router.post('/register', limiters.start, controller.startRegistration);
  router.get('/verification', controller.getVerification);
  router.post('/verify-email', limiters.verify, controller.verifyEmail);
  router.post('/register/complete', controller.completeRegistration);
  router.post('/password-reset', limiters.start, controller.startPasswordReset);
  router.post('/password-reset/complete', controller.completePasswordReset);
  router.post('/login', limiters.login, controller.login);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);
  router.get('/session', requireAuth, controller.getSession);

  return router;
}
