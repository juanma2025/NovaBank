import { CreateTopupRequestSchema } from '@nova/shared';
import type { Request, Response } from 'express';

import { readIdempotencyKey } from '../../lib/idempotency/idempotency-key.js';
import { authUserId } from '../accounts/accounts.controller.js';
import type { TopupsService } from './topups.service.js';

/** Controlador de recargas (spec 002, US2). */
export function createTopupsController(deps: { topups: TopupsService }) {
  return {
    /** GET /topups/limits (operación getTopupLimits). */
    async getTopupLimits(req: Request, res: Response): Promise<void> {
      res.json(await deps.topups.limits(authUserId(req)));
    },

    /** POST /topups (operación createTopup): exige Idempotency-Key (regla de dominio 4). */
    async createTopup(req: Request, res: Response): Promise<void> {
      const idempotencyKey = readIdempotencyKey(req);
      const { amount } = CreateTopupRequestSchema.parse(req.body);
      const outcome = await deps.topups.create({
        userId: authUserId(req),
        idempotencyKey,
        amount,
        requestId: req.requestId,
      });
      res.status(outcome.status).json(outcome.body);
    },
  };
}

export type TopupsController = ReturnType<typeof createTopupsController>;
