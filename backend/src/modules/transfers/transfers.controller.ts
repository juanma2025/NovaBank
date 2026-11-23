import { CreateTransferRequestSchema, RecipientQuerySchema } from '@nova/shared';
import type { Request, Response } from 'express';

import { readIdempotencyKey } from '../../lib/idempotency/idempotency-key.js';
import { authUserId } from '../accounts/accounts.controller.js';
import type { TransfersService } from './transfers.service.js';

/** Controlador de transferencias (spec 003, US1). */
export function createTransfersController(deps: { transfers: TransfersService }) {
  return {
    /** GET /transfers/recipient (operación findRecipient). */
    async findRecipient(req: Request, res: Response): Promise<void> {
      const { q } = RecipientQuerySchema.parse(req.query);
      res.json(await deps.transfers.findRecipient(authUserId(req), q));
    },

    /** GET /transfers/limits (operación getTransferLimits). */
    async getTransferLimits(req: Request, res: Response): Promise<void> {
      res.json(await deps.transfers.limits(authUserId(req)));
    },

    /** POST /transfers (operación createTransfer): exige Idempotency-Key (regla de dominio 4). */
    async createTransfer(req: Request, res: Response): Promise<void> {
      const idempotencyKey = readIdempotencyKey(req);
      const { recipientId, amount, note, password } = CreateTransferRequestSchema.parse(req.body);
      const outcome = await deps.transfers.create({
        userId: authUserId(req),
        idempotencyKey,
        recipientId,
        amount,
        note,
        password,
        requestId: req.requestId,
      });
      res.status(outcome.status).json(outcome.body);
    },
  };
}

export type TransfersController = ReturnType<typeof createTransfersController>;
