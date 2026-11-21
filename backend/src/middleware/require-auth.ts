import type { RequestHandler } from 'express';

import { appError } from '../lib/errors.js';
import { COOKIE, readCookie } from '../modules/auth/auth.cookies.js';
import type { SessionService } from '../modules/auth/session.service.js';

/**
 * Exige un JWT de acceso válido y una sesión vigente (tasks.md T031). Deja la sesión en
 * `res.locals.session` y `req.auth = { userId, sessionId }`.
 */
export function createRequireAuth(sessions: SessionService): RequestHandler {
  return async (req, res, next) => {
    const token = readCookie(req.cookies, COOKIE.access);
    if (!token) throw appError('UNAUTHENTICATED');
    const claims = sessions.verifyAccessToken(token);
    const session = await sessions.validate(claims.sessionId, req.requestId);
    if (session.userId !== claims.userId) throw appError('UNAUTHENTICATED');
    req.auth = { userId: session.userId, sessionId: session.id };
    res.locals.session = session;
    next();
  };
}
