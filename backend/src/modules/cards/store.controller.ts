import { CreateCardPaymentRequestSchema } from '@nova/shared';
import type { Request, Response } from 'express';

import { readIdempotencyKey } from '../../lib/idempotency/idempotency-key.js';
import { authUserId } from '../accounts/accounts.controller.js';
import type { PaymentsService } from './payments.service.js';

/** Controlador de la tienda demo (spec 004, US3). */
export function createStoreController(deps: { payments: PaymentsService }) {
  return {
    /** GET /store/limits (operación getPaymentLimits). */
    async getPaymentLimits(req: Request, res: Response): Promise<void> {
      res.json(await deps.payments.limits(authUserId(req)));
    },

    /** POST /store/payments (operación createCardPayment): exige Idempotency-Key. */
    async createCardPayment(req: Request, res: Response): Promise<void> {
      const idempotencyKey = readIdempotencyKey(req);
      const body = CreateCardPaymentRequestSchema.parse(req.body);
      const outcome = await deps.payments.pay({
        userId: authUserId(req),
        idempotencyKey,
        ...body,
        requestId: req.requestId,
      });
      res.status(outcome.status).json(outcome.body);
    },
  };
}

export type StoreController = ReturnType<typeof createStoreController>;
