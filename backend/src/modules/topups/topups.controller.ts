import { CreateTopupRequestSchema, IDEMPOTENCY_HEADER } from '@nova/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { appError } from '../../lib/errors.js';
import { authUserId } from '../accounts/accounts.controller.js';
import type { TopupsService } from './topups.service.js';

const IdempotencyKeySchema = z.string().min(8).max(100);

/** Controlador de recargas (spec 002, US2). */
export function createTopupsController(deps: { topups: TopupsService }) {
  return {
    /** GET /topups/limits (operación getTopupLimits). */
    async getTopupLimits(req: Request, res: Response): Promise<void> {
      res.json(await deps.topups.limits(authUserId(req)));
    },

    /** POST /topups (operación createTopup): exige Idempotency-Key (regla de dominio 4). */
    async createTopup(req: Request, res: Response): Promise<void> {
      const key = IdempotencyKeySchema.safeParse(req.get(IDEMPOTENCY_HEADER));
      if (!key.success) {
        throw appError('VALIDATION_ERROR', { fields: { [IDEMPOTENCY_HEADER]: 'required' } });
      }
      const { amount } = CreateTopupRequestSchema.parse(req.body);
      const outcome = await deps.topups.create({
        userId: authUserId(req),
        idempotencyKey: key.data,
        amount,
        requestId: req.requestId,
      });
      res.status(outcome.status).json(outcome.body);
    },
  };
}

export type TopupsController = ReturnType<typeof createTopupsController>;
