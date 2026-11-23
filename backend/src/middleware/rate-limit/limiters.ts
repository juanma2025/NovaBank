import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

import type { Clock } from '../../lib/clock.js';
import { secondsUntil } from '../../lib/clock.js';
import type { PrismaClient } from '../../lib/db.js';
import { sendError } from '../error-handler.js';
import { PgRateLimitStore } from './pg-store.js';

const MINUTE = 60_000;

/** Límites por IP de research R7 (defensa genérica; el bloqueo por cuenta vive en auth). */
const LIMITS = {
  login: { windowMs: 15 * MINUTE, limit: 30 },
  start: { windowMs: 60 * MINUTE, limit: 20 },
  verify: { windowMs: 15 * MINUTE, limit: 60 },
  topups: { windowMs: 15 * MINUTE, limit: 30 },
  // Spec 003 (plan.md): búsquedas de destinatario (anti-rastreo) y envíos.
  recipientLookup: { windowMs: 15 * MINUTE, limit: 60 },
  transfers: { windowMs: 15 * MINUTE, limit: 30 },
  // Spec 004 (plan.md): emisión de tarjetas, ver datos (costo de Argon2) y pagos en la tienda.
  cardIssue: { windowMs: 60 * MINUTE, limit: 10 },
  cardReveal: { windowMs: 15 * MINUTE, limit: 30 },
  storePayments: { windowMs: 15 * MINUTE, limit: 30 },
  // Spec 005 (plan.md): aportes, retiros y cierres de metas.
  savingsMovements: { windowMs: 15 * MINUTE, limit: 60 },
} as const;

export type LimiterName = keyof typeof LIMITS;
export type Limiters = Record<LimiterName, RequestHandler>;

const passThrough: RequestHandler = (_req, _res, next) => next();

export function createLimiters(
  prisma: PrismaClient,
  clock: Clock,
  { enabled }: { enabled: boolean },
): Limiters {
  const build = (name: LimiterName): RequestHandler => {
    if (!enabled) return passThrough;
    const { windowMs, limit } = LIMITS[name];
    return rateLimit({
      windowMs,
      limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      store: new PgRateLimitStore(prisma, clock, `rl:${name}`),
      handler: (req, res, _next, options) => {
        const resetTime = (req as { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
        const retryAfterSeconds = resetTime
          ? secondsUntil(clock.now(), resetTime)
          : Math.ceil(options.windowMs / 1000);
        sendError(res, req.requestId, 'RATE_LIMITED', { retryAfterSeconds });
      },
    });
  };
  return {
    login: build('login'),
    start: build('start'),
    verify: build('verify'),
    topups: build('topups'),
    recipientLookup: build('recipientLookup'),
    transfers: build('transfers'),
    cardIssue: build('cardIssue'),
    cardReveal: build('cardReveal'),
    storePayments: build('storePayments'),
    savingsMovements: build('savingsMovements'),
  };
}
