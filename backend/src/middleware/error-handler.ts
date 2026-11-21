import type { ErrorCode, ErrorDetails, ErrorResponse } from '@nova/shared';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

import { ERROR_MESSAGES } from '../lib/error-messages.js';
import { AppError, ERROR_STATUS, appError } from '../lib/errors.js';
import type { Logger } from '../lib/logger.js';

export function sendError(
  res: Response,
  requestIdValue: string,
  code: ErrorCode,
  details?: ErrorDetails,
): void {
  if (details?.retryAfterSeconds !== undefined) {
    res.setHeader('Retry-After', String(details.retryAfterSeconds));
  }
  const body: ErrorResponse = {
    error: {
      code,
      message: ERROR_MESSAGES[code],
      requestId: requestIdValue,
      ...(details ? { details } : {}),
    },
  };
  res.status(ERROR_STATUS[code]).json(body);
}

function fieldsFromZod(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    fields[key] ??= issue.code;
  }
  return fields;
}

function isBodyParserError(err: unknown): err is { type: string } {
  return typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string';
}

/** 404 JSON para rutas `/api/*` inexistentes. */
export const apiNotFound: RequestHandler = (_req, _res, next) => {
  next(appError('NOT_FOUND'));
};

/**
 * Middleware central de errores (constitución: formato uniforme con requestId; los 500 son
 * opacos para el cliente y el detalle va a pino).
 */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    if (err instanceof AppError) {
      sendError(res, req.requestId, err.code, err.details);
      return;
    }
    if (err instanceof ZodError) {
      sendError(res, req.requestId, 'VALIDATION_ERROR', { fields: fieldsFromZod(err) });
      return;
    }
    if (isBodyParserError(err) && err.type.startsWith('entity.')) {
      sendError(res, req.requestId, 'VALIDATION_ERROR', { fields: { _: err.type } });
      return;
    }
    logger.error({ err, requestId: req.requestId }, 'error no controlado');
    sendError(res, req.requestId, 'INTERNAL_ERROR');
  };
}
