import {
  CreateGoalRequestSchema,
  GoalMovementsQuerySchema,
  SavingsAmountRequestSchema,
  UpdateGoalRequestSchema,
} from '@nova/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { appError } from '../../lib/errors.js';
import { readIdempotencyKey } from '../../lib/idempotency/idempotency-key.js';
import { authUserId } from '../accounts/accounts.controller.js';
import type { SavingsService } from './savings.service.js';

const GoalIdSchema = z.uuid();

/** Un id que no es UUID se trata como inexistente: 404, igual que una meta ajena (FR-015). */
function goalIdOf(req: Request): string {
  const id = GoalIdSchema.safeParse(req.params.goalId);
  if (!id.success) throw appError('NOT_FOUND');
  return id.data;
}

/** Controlador de metas de ahorro (spec 005). */
export function createSavingsController(deps: { savings: SavingsService }) {
  const { savings } = deps;

  async function move(req: Request, res: Response, direction: 'deposit' | 'withdraw') {
    const goalId = goalIdOf(req);
    const idempotencyKey = readIdempotencyKey(req);
    const { amount } = SavingsAmountRequestSchema.parse(req.body);
    const outcome = await savings[direction]({
      userId: authUserId(req),
      goalId,
      amount,
      idempotencyKey,
      requestId: req.requestId,
    });
    res.status(outcome.status).json(outcome.body);
  }

  return {
    /** GET /savings/goals (operación listMyGoals). */
    async listMyGoals(req: Request, res: Response): Promise<void> {
      res.json(await savings.list(authUserId(req)));
    },

    /** POST /savings/goals (operación createGoal). */
    async createGoal(req: Request, res: Response): Promise<void> {
      const body = CreateGoalRequestSchema.parse(req.body);
      res.status(201).json(await savings.create(authUserId(req), body, req.requestId));
    },

    /** PATCH /savings/goals/{goalId} (operación updateGoal). */
    async updateGoal(req: Request, res: Response): Promise<void> {
      const goalId = goalIdOf(req);
      const body = UpdateGoalRequestSchema.parse(req.body);
      res.json(await savings.update(authUserId(req), goalId, body));
    },

    /** POST /savings/goals/{goalId}/deposits (operación depositToGoal). */
    depositToGoal: (req: Request, res: Response) => move(req, res, 'deposit'),

    /** POST /savings/goals/{goalId}/withdrawals (operación withdrawFromGoal). */
    withdrawFromGoal: (req: Request, res: Response) => move(req, res, 'withdraw'),

    /** POST /savings/goals/{goalId}/close (operación closeGoal). */
    async closeGoal(req: Request, res: Response): Promise<void> {
      const goalId = goalIdOf(req);
      const idempotencyKey = readIdempotencyKey(req);
      const outcome = await savings.close(authUserId(req), goalId, idempotencyKey, req.requestId);
      res.status(outcome.status).json(outcome.body);
    },

    /** GET /savings/goals/{goalId}/movements (operación listGoalMovements). */
    async listGoalMovements(req: Request, res: Response): Promise<void> {
      const goalId = goalIdOf(req);
      const query = GoalMovementsQuerySchema.parse(req.query);
      res.json(await savings.listMovements(authUserId(req), goalId, query));
    },

    /** GET /savings/limits (operación getSavingsLimits). */
    async getSavingsLimits(req: Request, res: Response): Promise<void> {
      res.json(await savings.limits(authUserId(req)));
    },
  };
}

export type SavingsController = ReturnType<typeof createSavingsController>;
