import { lockedUntil } from '../../lib/attempt-lock.js';
import { secondsUntil } from '../../lib/clock.js';
import { sha256Hex } from '../../lib/crypto.js';
import { appError } from '../../lib/errors.js';
import type { AuthContext } from './auth.context.js';
import { verifyPassword } from './password-policy.js';
import { loginAttemptRepository as attempts } from './repositories/login-attempt.repository.js';
import { userRepository } from './repositories/user.repository.js';

/** Regla por origen de la spec 001 (data-model.md `LoginAttempt`): 5 fallos en 15 min. */
const REAUTH_RULE = { failures: 5, windowMs: 15 * 60 * 1000 };

/** Clave de origen de la reautenticación (spec 003, data-model.md `LoginAttempt`). */
export const reauthOriginKey = (userId: string): string => sha256Hex(`reauth:${userId}`);

/**
 * Reautenticación con contraseña por encima del umbral (spec 003, research R4). Se llama FUERA de
 * la transacción del movimiento para que los fallos se acumulen aunque la operación no siga.
 *
 * Los fallos se guardan en `login_attempts` con el correo del usuario, así que también cuentan para
 * la regla global de la spec 001 (20 por hora por correo): defensa extra ante una sesión robada.
 */
export function createReauthService(ctx: AuthContext) {
  const { prisma, clock, logger } = ctx;

  async function currentLock(email: string, originKey: string): Promise<Date | null> {
    const latest = await attempts.latest(prisma, email, REAUTH_RULE.failures, originKey);
    const until = lockedUntil(latest, REAUTH_RULE);
    return until && until > clock.now() ? until : null;
  }

  const lockedError = (until: Date) =>
    appError('REAUTH_LOCKED', { retryAfterSeconds: secondsUntil(clock.now(), until) });

  /**
   * Verifica la contraseña del usuario. Lanza `REAUTH_LOCKED` (429) si está bloqueado o queda
   * bloqueado con este fallo, y `REAUTH_FAILED` (422) si es incorrecta. Un acierto borra los fallos.
   */
  async function verify(userId: string, password: string, requestId: string): Promise<void> {
    const user = await userRepository.findById(prisma, userId);
    if (!user) throw appError('UNAUTHENTICATED');
    const originKey = reauthOriginKey(userId);

    const activeLock = await currentLock(user.email, originKey);
    // Como en el login: los intentos durante un bloqueo no se registran (no lo alargan).
    if (activeLock) throw lockedError(activeLock);

    if (await verifyPassword(user.passwordHash, password)) {
      await attempts.deleteForOrigin(prisma, user.email, originKey);
      return;
    }

    await attempts.insert(prisma, user.email, originKey, clock.now());
    const newLock = await currentLock(user.email, originKey);
    if (newLock) {
      logger.warn({ requestId, userId }, 'reautenticación bloqueada por intentos fallidos');
      throw lockedError(newLock);
    }
    throw appError('REAUTH_FAILED');
  }

  return { verify };
}

export type ReauthService = ReturnType<typeof createReauthService>;
