import type { RequestHandler } from 'express';

import { appError } from '../lib/errors.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * En métodos que modifican datos, un cuerpo no vacío debe ser JSON. Las peticiones JSON
 * entre orígenes requieren preflight CORS, que solo se permite a APP_ORIGIN; junto con las
 * cookies SameSite=Strict, esto cierra el paso a CSRF (tasks.md T025).
 */
export const requireJson: RequestHandler = (req, _res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();
  const length = Number(req.headers['content-length'] ?? 0);
  const hasBody = length > 0 || req.headers['transfer-encoding'] !== undefined;
  if (hasBody && !req.is('application/json')) {
    return next(appError('VALIDATION_ERROR', { fields: { _: 'content_type' } }));
  }
  next();
};
