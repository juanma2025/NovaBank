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
/** Ventana para el refresh token anterior (varias pestañas refrescando a la vez, research R2). */
const REUSE_WINDOW_MS = 10_000;

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
  async function assertActive(session: Session | null, requestId: string): Promise<Session> {
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
    return session;
  }

  async function validate(sessionId: string, requestId: string): Promise<Session> {
    const session = await assertActive(
      await sessionRepository.findById(prisma, sessionId),
      requestId,
    );
    const now = clock.now();
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

  /**
   * Renueva el acceso y registra actividad (research R2). Devuelve `tokens: null` cuando llega el
   * refresh token anterior dentro de la ventana de 10 s: la otra pestaña ya recibió las cookies.
   */
  async function refresh(
    refreshToken: string | undefined,
    requestId: string,
  ): Promise<{ session: Session; tokens: { accessToken: string; refreshToken: string } | null }> {
    if (!refreshToken) throw appError('UNAUTHENTICATED');
    const hash = sha256Hex(refreshToken);
    const now = clock.now();

    const current = await sessionRepository.findByRefreshHash(prisma, hash);
    if (current) {
      const session = await assertActive(current, requestId);
      const next = randomToken();
      if (await sessionRepository.rotate(prisma, session.id, hash, sha256Hex(next), now)) {
        return {
          session: { ...session, lastActivityAt: now },
          tokens: { accessToken: signAccessToken(session.userId, session.id), refreshToken: next },
        };
      }
      // Otra solicitud rotó al mismo tiempo: se trata como la ventana de varias pestañas.
    }

    const previous = current ?? (await sessionRepository.findByPreviousRefreshHash(prisma, hash));
    if (!previous) throw appError('UNAUTHENTICATED');
    const session = await assertActive(
      await sessionRepository.findById(prisma, previous.id),
      requestId,
    );
    const rotatedAt = session.rotatedAt?.getTime() ?? 0;
    if (now.getTime() - rotatedAt <= REUSE_WINDOW_MS) {
      await sessionRepository.touch(prisma, session.id, now);
      return { session: { ...session, lastActivityAt: now }, tokens: null };
    }
    await endSession(session, 'reuse_detected', requestId);
    throw appError('SESSION_EXPIRED', { reason: 'revoked' });
  }

  /** Cierra la sesión del refresh token o, si no hay, la del JWT de acceso aunque haya vencido. */
  async function logout(
    tokens: { refreshToken?: string; accessToken?: string },
    requestId: string,
  ): Promise<void> {
    let session: Session | null = null;
    if (tokens.refreshToken) {
      const hash = sha256Hex(tokens.refreshToken);
      session =
        (await sessionRepository.findByRefreshHash(prisma, hash)) ??
        (await sessionRepository.findByPreviousRefreshHash(prisma, hash));
    }
    if (!session && tokens.accessToken) {
      const sid = sessionIdIgnoringExpiry(tokens.accessToken);
      if (sid) session = await sessionRepository.findById(prisma, sid);
    }
    if (session) await endSession(session, 'logout', requestId);
  }

  /** `sid` de un JWT con firma válida, aunque haya vencido (solo para cerrar sesión). */
  function sessionIdIgnoringExpiry(token: string): string | null {
    try {
      const payload = jwt.verify(token, config.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
        ignoreExpiration: true,
      });
      if (typeof payload === 'string') return null;
      const sid: unknown = payload.sid;
      return typeof sid === 'string' ? sid : null;
    } catch {
      return null;
    }
  }

  return {
    create,
    validate,
    verifyAccessToken,
    toSessionInfo,
    revokeAllForUser,
    endSession,
    refresh,
    logout,
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
