import { IDEMPOTENCY_HEADER } from '@nova/shared';
import type { Request } from 'express';
import { z } from 'zod';

import { appError } from '../errors.js';

const IdempotencyKeySchema = z.string().min(8).max(100);

/** Lee y valida `Idempotency-Key` (regla de dominio 4); si falta o es inválida, 400. */
export function readIdempotencyKey(req: Request): string {
  const key = IdempotencyKeySchema.safeParse(req.get(IDEMPOTENCY_HEADER));
  if (!key.success) {
    throw appError('VALIDATION_ERROR', { fields: { [IDEMPOTENCY_HEADER]: 'required' } });
  }
  return key.data;
}
