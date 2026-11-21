import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

/** Asigna un UUID v4 a cada solicitud y lo expone en `X-Request-Id`. */
export const requestId: RequestHandler = (req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
