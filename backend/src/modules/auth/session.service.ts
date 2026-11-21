import type { Session, SessionEndReason } from '@nova/db';
import type { SessionInfo } from '@nova/shared';
import jwt from 'jsonwebtoken';

import { addSeconds } from '../../lib/clock.js';
import { randomToken, sha256Hex } from '../../lib/crypto.js';
import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import type { AuthContext } from './auth.context.js';
import { sessionRepository } from './repositories/session.repository.js';

const ACCESS_TOKEN_SECONDS = 15 * 60;
const ABSOLUTE_SESSION_SECONDS = 12 * 60 * 60;
const TOUCH_THROTTLE_MS = 30_000;

export interface IssuedSession {
  session: Session;
  accessToken: string;
  refreshToken: string;
}

export interface AccessClaims {
  userId: string;
  sessionId: string;
}

/** Sesión en base de datos + JWT de acceso de 15 min + refresh token opaco (research R1). */
export function createSessionService(ctx: AuthContext) {
  const { config, prisma, clock, audit } = ctx;
  const nowSeconds = (): number => Math.floor(clock.now().getTime() / 1000);

  function signAccessToken(userId: string, sessionId: string): string {
    return jwt.sign({ sid: sessionId, iat: nowSeconds() }, config.JWT_ACCESS_SECRET, {
      subject: userId,
      expiresIn: ACCESS_TOKEN_SECONDS,
      algorithm: 'HS256',
    });
  }

  /** Verifica el JWT de acceso. Lanza ACCESS_TOKEN_EXPIRED o UNAUTHENTICATED. */
  function verifyAccessToken(token: string): AccessClaims {
    try {
      const payload = jwt.verify(token, config.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
        clockTimestamp: nowSeconds(),
      });
      if (typeof payload === 'string' || typeof payload.sub !== 'string') throw new Error();
      const sid: unknown = payload.sid;
      if (typeof sid !== 'string') throw new Error();
      return { userId: payload.sub, sessionId: sid };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) throw appError('ACCESS_TOKEN_EXPIRED');
      throw appError('UNAUTHENTICATED');
    }
  }

  async function create(db: Db, userId: string): Promise<IssuedSession> {
    const now = clock.now();
    const refreshToken = randomToken();
    const session = await sessionRepository.create(db, {
      userId,
      refreshTokenHash: sha256Hex(refreshToken),
      now,
      absoluteExpiresAt: addSeconds(now, ABSOLUTE_SESSION_SECONDS),
    });
    return { session, accessToken: signAccessToken(userId, session.id), refreshToken };
  }

  async function endSession(
    session: Session,
    reason: SessionEndReason,
    requestId: string,
  ): Promise<void> {
    const revoked = await sessionRepository.revoke(prisma, session.id, reason, clock.now());
    if (revoked) {
      await audit.record(prisma, 'SESSION_ENDED', {
        userId: session.userId,
        requestId,
        metadata: { reason, sessionId: session.id },
      });
    }
  }

  /**
   * Regla de vigencia de data-model.md `Session`: no revocada, sin superar la inactividad ni
   * las 12 h. Si venció, la revoca, la audita y lanza SESSION_EXPIRED con su motivo.
   */
  async function validate(sessionId: string, requestId: string): Promise<Session> {
    const session = await sessionRepository.findById(prisma, sessionId);
    if (!session || session.revokedAt) {
      throw appError('SESSION_EXPIRED', { reason: 'revoked' });
    }
    const now = clock.now();
    const idleMs = config.session.idleTimeoutSeconds * 1000;
    if (now.getTime() - session.lastActivityAt.getTime() > idleMs) {
      await endSession(session, 'idle', requestId);
      throw appError('SESSION_EXPIRED', { reason: 'idle' });
    }
    if (now >= session.absoluteExpiresAt) {
      await endSession(session, 'absolute', requestId);
      throw appError('SESSION_EXPIRED', { reason: 'absolute' });
    }
    if (now.getTime() - session.lastActivityAt.getTime() >= TOUCH_THROTTLE_MS) {
      await sessionRepository.touch(prisma, session.id, now);
      return { ...session, lastActivityAt: now };
    }
    return session;
  }

  function toSessionInfo(session: Session): SessionInfo {
    return {
      idleTimeoutSeconds: config.session.idleTimeoutSeconds,
      idleWarningSeconds: config.session.idleWarningSeconds,
      lastActivityAt: session.lastActivityAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    };
  }

  async function revokeAllForUser(
    db: Db,
    userId: string,
    reason: SessionEndReason,
    requestId: string,
  ): Promise<void> {
    const ids = await sessionRepository.revokeAllForUser(db, userId, reason, clock.now());
    for (const sessionId of ids) {
      await audit.record(db, 'SESSION_ENDED', {
        userId,
        requestId,
        metadata: { reason, sessionId },
      });
    }
  }

  return { create, validate, verifyAccessToken, toSessionInfo, revokeAllForUser, endSession };
}

export type SessionService = ReturnType<typeof createSessionService>;
