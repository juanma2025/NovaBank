import type { Limiters } from '../../middleware/rate-limit/limiters.js';
import type { AuthContext } from './auth.context.js';
import { createAuthDirectory } from './auth.directory.js';
import { createAuthController } from './auth.controller.js';
import { createAuthRouter } from './auth.routes.js';
import { createLoginService } from './login.service.js';
import { createPasswordResetService } from './password-reset.service.js';
import { createReauthService } from './reauth.service.js';
import { createRegistrationService } from './registration.service.js';
import { createSessionService } from './session.service.js';
import { createVerificationService } from './verification.service.js';

/** Construye los servicios del módulo auth y su router. */
export function createAuthModule(ctx: AuthContext, limiters: Limiters) {
  const sessions = createSessionService(ctx);
  const verification = createVerificationService(ctx);
  const registration = createRegistrationService(ctx, { sessions, verification });
  const login = createLoginService(ctx, { sessions });
  const passwordReset = createPasswordResetService(ctx, { sessions, verification });
  const controller = createAuthController(ctx, {
    sessions,
    verification,
    registration,
    login,
    passwordReset,
  });
  const router = createAuthRouter(controller, sessions, limiters);
  // Spec 003: lo que otros módulos usan de auth sin tocar sus tablas (research R1).
  const directory = createAuthDirectory();
  const reauth = createReauthService(ctx);
  return {
    router,
    sessions,
    verification,
    registration,
    login,
    passwordReset,
    directory,
    reauth,
  };
}

export type AuthModule = ReturnType<typeof createAuthModule>;
