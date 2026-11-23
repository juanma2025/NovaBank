import type { SessionResponse } from '@nova/shared';

import { lockedUntil } from '../../lib/attempt-lock.js';
import { secondsUntil } from '../../lib/clock.js';
import { sha256Hex } from '../../lib/crypto.js';
import { appError } from '../../lib/errors.js';
import type { AuthContext } from './auth.context.js';
import { hashPassword, verifyPassword } from './password-policy.js';
import { loginAttemptRepository as attempts } from './repositories/login-attempt.repository.js';
import { userRepository } from './repositories/user.repository.js';
import type { IssuedSession, SessionService } from './session.service.js';

/** Reglas de bloqueo de data-model.md `LoginAttempt` (FR-015, research R7). */
const ORIGIN_RULE = { failures: 5, windowMs: 15 * 60 * 1000 };
const GLOBAL_RULE = { failures: 20, windowMs: 60 * 60 * 1000 };

export interface LoginInput {
  email: string;
  password: string;
  /** Identificador del dispositivo (cookie nova_dev) o, si no hay, la IP. */
  device: { id?: string; ip: string };
  requestId: string;
}

export interface LoginResult {
  issued: IssuedSession;
  response: SessionResponse;
}

/** Clave de origen: hash del dispositivo o, sin cookie, hash de la IP (research R7). */
export function originKeyFor(device: { id?: string; ip: string }): string {
  return sha256Hex(device.id ? `dev:${device.id}` : `ip:${device.ip}`);
}

export function createLoginService(ctx: AuthContext, deps: { sessions: SessionService }) {
  const { prisma, clock, audit } = ctx;
  let dummyHash: Promise<string> | null = null;
  /** Hash ficticio para igualar tiempos cuando el correo no existe (research R5). */
  const getDummyHash = (): Promise<string> =>
    (dummyHash ??= hashPassword('contraseña-ficticia-para-igualar-tiempos'));

  async function currentLock(email: string, originKey: string): Promise<Date | null> {
    const [byOrigin, global] = await Promise.all([
      attempts.latest(prisma, email, ORIGIN_RULE.failures, originKey),
      attempts.latest(prisma, email, GLOBAL_RULE.failures),
    ]);
    const now = clock.now();
    const locks = [lockedUntil(byOrigin, ORIGIN_RULE), lockedUntil(global, GLOBAL_RULE)].filter(
      (until): until is Date => until !== null && until > now,
    );
    return locks.length > 0 ? new Date(Math.max(...locks.map((d) => d.getTime()))) : null;
  }

  const lockedError = (until: Date) =>
    appError('LOGIN_LOCKED', { retryAfterSeconds: secondsUntil(clock.now(), until) });

  async function login({ email, password, device, requestId }: LoginInput): Promise<LoginResult> {
    const originKey = originKeyFor(device);
    const activeLock = await currentLock(email, originKey);
    // Los intentos rechazados por un bloqueo activo no se registran (no lo alargan).
    if (activeLock) throw lockedError(activeLock);

    const user = await userRepository.findByEmail(prisma, email);
    let valid = false;
    if (user) {
      valid = await verifyPassword(user.passwordHash, password);
    } else {
      // Mismo costo de Argon2 aunque el correo no exista: el tiempo no revela cuentas.
      await verifyPassword(await getDummyHash(), password);
    }

    if (!user || !valid) {
      await attempts.insert(prisma, email, originKey, clock.now());
      await audit.record(prisma, 'LOGIN_FAILED', { userId: user?.id ?? null, email, requestId });
      const newLock = await currentLock(email, originKey);
      if (newLock) {
        await audit.record(prisma, 'LOGIN_LOCKED', { userId: user?.id ?? null, email, requestId });
        throw lockedError(newLock);
      }
      throw appError('INVALID_CREDENTIALS');
    }

    const issued = await prisma.$transaction(async (tx) => {
      await attempts.deleteForOrigin(tx, email, originKey);
      const created = await deps.sessions.create(tx, user.id);
      await audit.record(tx, 'LOGIN_SUCCEEDED', { userId: user.id, requestId });
      return created;
    });
    return {
      issued,
      response: {
        user: { id: user.id, email: user.email, fullName: user.fullName },
        session: deps.sessions.toSessionInfo(issued.session),
      },
    };
  }

  return { login };
}

export type LoginService = ReturnType<typeof createLoginService>;
