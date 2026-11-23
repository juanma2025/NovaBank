import { CreateSplitRequestSchema, PayShareRequestSchema, SplitsQuerySchema } from '@nova/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { appError } from '../../lib/errors.js';
import { readIdempotencyKey } from '../../lib/idempotency/idempotency-key.js';
import { authUserId } from '../accounts/accounts.controller.js';
import type { SplitsService } from './splits.service.js';

const IdSchema = z.uuid();

/** Un id que no es UUID se trata como inexistente: 404 (FR-014). */
function idOf(req: Request, param: 'splitId' | 'shareId'): string {
  const id = IdSchema.safeParse(req.params[param]);
  if (!id.success) throw appError('NOT_FOUND');
  return id.data;
}

/** Controlador de gastos compartidos (spec 007). */
export function createSplitsController(deps: { splits: SplitsService }) {
  const { splits } = deps;

  return {
    /** GET /splits (operación listMySplits). */
    async listMySplits(req: Request, res: Response): Promise<void> {
      const query = SplitsQuerySchema.parse(req.query);
      res.json(await splits.list(authUserId(req), query));
    },

    /** POST /splits (operación createSplit): no mueve dinero. */
    async createSplit(req: Request, res: Response): Promise<void> {
      const body = CreateSplitRequestSchema.parse(req.body);
      res.status(201).json(await splits.create(authUserId(req), body));
    },

    /** GET /splits/summary (operación getSplitsSummary). */
    async getSplitsSummary(req: Request, res: Response): Promise<void> {
      res.json(await splits.summary(authUserId(req)));
    },

    /** GET /splits/{splitId} (operación getSplit). */
    async getSplit(req: Request, res: Response): Promise<void> {
      res.json(await splits.get(authUserId(req), idOf(req, 'splitId')));
    },

    /** POST /splits/{splitId}/cancel (operación cancelSplit). */
    async cancelSplit(req: Request, res: Response): Promise<void> {
      res.json(await splits.cancel(authUserId(req), idOf(req, 'splitId')));
    },

    /** POST /splits/{splitId}/shares/me/pay (operación paySplitShare): exige Idempotency-Key. */
    async paySplitShare(req: Request, res: Response): Promise<void> {
      const splitId = idOf(req, 'splitId');
      const idempotencyKey = readIdempotencyKey(req);
      const { password } = PayShareRequestSchema.parse(req.body ?? {});
      const outcome = await splits.payMyShare({
        userId: authUserId(req),
        splitId,
        password,
        idempotencyKey,
        requestId: req.requestId,
      });
      res.status(outcome.status).json(outcome.body);
    },

    /** POST /splits/{splitId}/shares/me/decline (operación declineSplitShare). */
    async declineSplitShare(req: Request, res: Response): Promise<void> {
      res.json(await splits.declineMyShare(authUserId(req), idOf(req, 'splitId')));
    },

    /** POST /splits/{splitId}/shares/{shareId}/mark-paid (operación markSplitSharePaid). */
    async markSplitSharePaid(req: Request, res: Response): Promise<void> {
      res.json(await splits.markPaid(authUserId(req), idOf(req, 'splitId'), idOf(req, 'shareId')));
    },

    /** POST /splits/{splitId}/shares/{shareId}/remind (operación remindSplitShare). */
    async remindSplitShare(req: Request, res: Response): Promise<void> {
      res.json(await splits.remind(authUserId(req), idOf(req, 'splitId'), idOf(req, 'shareId')));
    },
  };
}

export type SplitsController = ReturnType<typeof createSplitsController>;
