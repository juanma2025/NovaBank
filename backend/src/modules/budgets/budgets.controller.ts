import {
  BudgetCategorySchema,
  BudgetMonthQuerySchema,
  BudgetTransfersQuerySchema,
  SetBudgetLimitRequestSchema,
  SetTransferCategoryRequestSchema,
  type BudgetAlertList,
  type BudgetCategory,
} from '@nova/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { appError } from '../../lib/errors.js';
import { authUserId } from '../accounts/accounts.controller.js';
import type { BudgetsService } from './budgets.service.js';

const IdSchema = z.uuid();

/** Una categoría desconocida en la ruta es un dato inválido, no un recurso ajeno: 400. */
function categoryOf(req: Request): BudgetCategory {
  const category = BudgetCategorySchema.safeParse(req.params.category);
  if (!category.success) {
    throw appError('VALIDATION_ERROR', { fields: { category: 'invalid' } });
  }
  return category.data;
}

/** Un id que no es UUID se trata como inexistente: 404 (FR-013). */
function idOf(req: Request, param: string): string {
  const id = IdSchema.safeParse(req.params[param]);
  if (!id.success) throw appError('NOT_FOUND');
  return id.data;
}

/** Controlador del presupuesto (spec 006). */
export function createBudgetsController(deps: { budgets: BudgetsService }) {
  const { budgets } = deps;

  return {
    /** GET /budgets (operación getBudgetMonth). */
    async getBudgetMonth(req: Request, res: Response): Promise<void> {
      const { month } = BudgetMonthQuerySchema.parse(req.query);
      res.json(await budgets.monthSummary(authUserId(req), month));
    },

    /** PUT /budgets/limits/{category} (operación setBudgetLimit). */
    async setBudgetLimit(req: Request, res: Response): Promise<void> {
      const category = categoryOf(req);
      const { monthlyLimit } = SetBudgetLimitRequestSchema.parse(req.body);
      res.json(await budgets.setLimit(authUserId(req), category, monthlyLimit));
    },

    /** DELETE /budgets/limits/{category} (operación removeBudgetLimit). */
    async removeBudgetLimit(req: Request, res: Response): Promise<void> {
      res.json(await budgets.removeLimit(authUserId(req), categoryOf(req)));
    },

    /** GET /budgets/alerts (operación listBudgetAlerts). */
    async listBudgetAlerts(req: Request, res: Response): Promise<void> {
      const body: BudgetAlertList = { items: await budgets.listAlerts(authUserId(req)) };
      res.json(body);
    },

    /** POST /budgets/alerts/{alertId}/seen (operación markBudgetAlertSeen). */
    async markBudgetAlertSeen(req: Request, res: Response): Promise<void> {
      res.json(await budgets.markSeen(authUserId(req), idOf(req, 'alertId')));
    },

    /** GET /budgets/transfers (operación listBudgetTransfers). */
    async listBudgetTransfers(req: Request, res: Response): Promise<void> {
      const query = BudgetTransfersQuerySchema.parse(req.query);
      res.json(await budgets.listTransfers(authUserId(req), query));
    },

    /** PUT /budgets/transfers/{transactionId}/category (operación setTransferCategory). */
    async setTransferCategory(req: Request, res: Response): Promise<void> {
      const transactionId = idOf(req, 'transactionId');
      const { category } = SetTransferCategoryRequestSchema.parse(req.body);
      res.json(await budgets.setTransferCategory(authUserId(req), transactionId, category));
    },
  };
}

export type BudgetsController = ReturnType<typeof createBudgetsController>;
