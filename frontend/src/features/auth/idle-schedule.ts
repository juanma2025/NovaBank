import type { SessionResponse } from '@nova/shared';

import type { SessionBroadcastMessage } from './services/session-broadcaster.ts';

export const MAX_REFRESH_THROTTLE_MS = 60_000;

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;

export type SessionEndCallbackReason = 'idle' | 'expirada' | 'logout';

export interface SessionTimings {
  idleTimeoutMs: number;
  warningOffsetMs: number;
  absoluteExpiresMs: number;
  refreshThrottleMs: number;
}

export type IdleSchedulePlan =
  | { mode: 'absolute'; delayMs: number }
  | { mode: 'idle'; warningDelayMs: number; idleDeadlineAt: number };

export function parseSessionContactMs(
  lastContact: number | null,
  session: SessionResponse,
): number {
  if (lastContact !== null) return lastContact;
  const parsed = Date.parse(session.session.lastActivityAt);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function deriveSessionTimings(session: SessionResponse | null): SessionTimings {
  if (!session) {
    return {
      idleTimeoutMs: 0,
      warningOffsetMs: 0,
      absoluteExpiresMs: Number.POSITIVE_INFINITY,
      refreshThrottleMs: MAX_REFRESH_THROTTLE_MS,
    };
  }
  const idleTimeoutMs = session.session.idleTimeoutSeconds * 1000;
  const idleWarningMs = session.session.idleWarningSeconds * 1000;
  const warningOffsetMs = Math.max(0, idleTimeoutMs - idleWarningMs);
  const parsedAbsolute = Date.parse(session.session.absoluteExpiresAt);
  const absoluteExpiresMs = Number.isFinite(parsedAbsolute)
    ? parsedAbsolute
    : Number.POSITIVE_INFINITY;
  const refreshThrottleMs = Math.min(
    MAX_REFRESH_THROTTLE_MS,
    Math.max(1_000, Math.floor(warningOffsetMs / 2)),
  );
  return { idleTimeoutMs, warningOffsetMs, absoluteExpiresMs, refreshThrottleMs };
}

/**
 * Calcula si la sesión vencerá primero por el límite absoluto de 12 h (spec.md: cierra directo
 * sin mostrar aviso «Seguir conectado») o por inactividad.
 */
export function computeIdleSchedulePlan(
  now: number,
  contactMs: number,
  timings: SessionTimings,
): IdleSchedulePlan {
  const idleDeadlineAt = contactMs + timings.idleTimeoutMs;

  if (timings.absoluteExpiresMs <= idleDeadlineAt) {
    return {
      mode: 'absolute',
      delayMs: Math.max(0, timings.absoluteExpiresMs - now),
    };
  }

  return {
    mode: 'idle',
    warningDelayMs: Math.max(0, contactMs + timings.warningOffsetMs - now),
    idleDeadlineAt,
  };
}

export function subscribeWindowActivity(onActivity: () => void): () => void {
  for (const evt of ACTIVITY_EVENTS) {
    window.addEventListener(evt, onActivity, { passive: true });
  }
  return () => {
    for (const evt of ACTIVITY_EVENTS) {
      window.removeEventListener(evt, onActivity);
    }
  };
}

export function mapBroadcastLogoutReason(
  reason: Extract<SessionBroadcastMessage, { type: 'logout' }>['reason'],
): SessionEndCallbackReason {
  if (reason === 'idle') return 'idle';
  if (reason === 'expired') return 'expirada';
  return 'logout';
}
