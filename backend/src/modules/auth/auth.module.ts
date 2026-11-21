import type { Limiters } from '../../middleware/rate-limit/limiters.js';
import type { AuthContext } from './auth.context.js';
import { createAuthController } from './auth.controller.js';
import { createAuthRouter } from './auth.routes.js';
import { createLoginService } from './login.service.js';
import { createRegistrationService } from './registration.service.js';
import { createSessionService } from './session.service.js';
import { createVerificationService } from './verification.service.js';

/** Construye los servicios del módulo auth y su router. */
export function createAuthModule(ctx: AuthContext, limiters: Limiters) {
  const sessions = createSessionService(ctx);
  const verification = createVerificationService(ctx);
  const registration = createRegistrationService(ctx, { sessions, verification });
  const login = createLoginService(ctx, { sessions });
  const controller = createAuthController(ctx, { sessions, verification, registration, login });
  const router = createAuthRouter(controller, sessions, limiters);
  return { router, sessions, verification, registration, login };
}

export type AuthModule = ReturnType<typeof createAuthModule>;
