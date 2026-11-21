import type { VerificationState } from '@nova/shared';

import { randomToken } from '../../lib/crypto.js';
import { appError } from '../../lib/errors.js';
import { outboxRepository } from '../../lib/mail/outbox.repository.js';
import type { AuthContext } from './auth.context.js';
import { checkPassword, hashPassword } from './password-policy.js';
import { loginAttemptRepository } from './repositories/login-attempt.repository.js';
import { userRepository } from './repositories/user.repository.js';
import type { SessionService } from './session.service.js';
import type { VerificationService } from './verification.service.js';

export interface StartResetResult {
  flowToken: string;
  state: VerificationState;
}

/** Recuperación de contraseña (US3): correo → código → contraseña nueva. */
export function createPasswordResetService(
  ctx: AuthContext,
  deps: { sessions: SessionService; verification: VerificationService },
) {
  const { prisma, clock, audit } = ctx;
  const { sessions, verification } = deps;

  /**
   * Paso 1 (FR-020, FR-020a, FR-005): misma respuesta exista o no la cuenta; sin cuenta, el
   * flujo es señuelo y no se envía nada. Reemplaza los flujos de recuperación anteriores.
   */
  async function start(email: string, requestId: string): Promise<StartResetResult> {
    const flowToken = randomToken();
    const flow = await prisma.$transaction(async (tx) => {
      await verification.assertSendLimit(tx, email);
      const user = await userRepository.findByEmail(tx, email);
      const created = await verification.createFlow(tx, {
        email,
        purpose: 'password_reset',
        flowToken,
      });
      const updated = await verification.requestCode(tx, created, { decoy: user === null });
      await audit.record(tx, 'PASSWORD_RESET_REQUESTED', {
        userId: user?.id ?? null,
        email,
        requestId,
      });
      return updated;
    });
    return { flowToken, state: verification.toState(flow) };
  }

  /**
   * Paso 3 (FR-020b, FR-020c): cambia la contraseña, cierra todas las sesiones, levanta los
   * bloqueos del correo y encola el aviso. No inicia sesión.
   */
  async function complete(
    flowToken: string | undefined,
    password: string,
    requestId: string,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const flow = await verification.lockForCompletion(tx, flowToken, 'password_reset');
      const user = await userRepository.findByEmail(tx, flow.email);
      if (!user) throw appError('VERIFICATION_NOT_FOUND');
      const violations = checkPassword(password, user.email);
      if (violations.length > 0) throw appError('PASSWORD_WEAK', { reasons: violations });

      const now = clock.now();
      await userRepository.updatePassword(tx, user.id, await hashPassword(password), now);
      await sessions.revokeAllForUser(tx, user.id, 'password_reset', requestId);
      await loginAttemptRepository.deleteByEmail(tx, user.email);
      await outboxRepository.enqueue(tx, { template: 'password_changed', to: user.email, now });
      await verification.markCompleted(tx, flow.id);
      await audit.record(tx, 'PASSWORD_RESET_COMPLETED', { userId: user.id, requestId });
    });
  }

  return { start, complete };
}

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
