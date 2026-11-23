/**
 * Esquemas de la API de presupuesto (spec 006). Cada esquema corresponde a un `components.schemas` de
 * specs/006-presupuesto/contracts/budgets.openapi.json.
 */
import { z } from 'zod';

import {
  BUDGET_CATEGORIES,
  BUDGET_LIMIT_MAX,
  BUDGET_LIMIT_MIN,
  BudgetCategorySchema,
  isValidMonth,
} from './budgets.js';
import { MOVEMENTS_PAGE_SIZE } from './constants.js';

export const MonthSchema = z.string().refine(isValidMonth, 'Usa el formato AAAA-MM');

const BudgetLimitSchema = z.int().min(BUDGET_LIMIT_MIN).max(BUDGET_LIMIT_MAX);

export const BudgetStatusSchema = z.enum(['none', 'ok', 'warning', 'exceeded']);

export const BudgetCategorySummarySchema = z.object({
  category: BudgetCategorySchema,
  spent: z.int().min(0),
  limit: BudgetLimitSchema.nullable(),
  /** Puede pasar de 100; null sin tope. */
  percent: z.int().min(0).nullable(),
  status: BudgetStatusSchema,
});
export type BudgetCategorySummary = z.infer<typeof BudgetCategorySummarySchema>;

export const BudgetMonthSchema = z.object({
  month: MonthSchema,
  totalSpent: z.int().min(0),
  /** Las 7 categorías, en el orden de BUDGET_CATEGORIES. */
  categories: z.array(BudgetCategorySummarySchema).length(BUDGET_CATEGORIES.length),
});
export type BudgetMonth = z.infer<typeof BudgetMonthSchema>;

/** Parámetros de `GET /budgets`. */
export const BudgetMonthQuerySchema = z.strictObject({ month: MonthSchema.optional() });
export type BudgetMonthQuery = z.infer<typeof BudgetMonthQuerySchema>;

export const SetBudgetLimitRequestSchema = z.strictObject({ monthlyLimit: BudgetLimitSchema });
export type SetBudgetLimitRequest = z.infer<typeof SetBudgetLimitRequestSchema>;

export const BudgetTransferSchema = z.object({
  transactionId: z.uuid(),
  description: z.string(),
  amount: z.int().min(1),
  createdAt: z.iso.datetime(),
  category: BudgetCategorySchema,
});
export type BudgetTransfer = z.infer<typeof BudgetTransferSchema>;

export const BudgetTransfersPageSchema = z.object({
  items: z.array(BudgetTransferSchema).max(MOVEMENTS_PAGE_SIZE),
  nextCursor: z.string().nullable(),
});
export type BudgetTransfersPage = z.infer<typeof BudgetTransfersPageSchema>;

/** Parámetros de `GET /budgets/transfers` (llegan como texto en la query string). */
export const BudgetTransfersQuerySchema = z.strictObject({
  month: MonthSchema.optional(),
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(MOVEMENTS_PAGE_SIZE).default(MOVEMENTS_PAGE_SIZE),
});
export type BudgetTransfersQuery = z.infer<typeof BudgetTransfersQuerySchema>;

export const SetTransferCategoryRequestSchema = z.strictObject({ category: BudgetCategorySchema });
export type SetTransferCategoryRequest = z.infer<typeof SetTransferCategoryRequestSchema>;

export const BudgetAlertSchema = z.object({
  id: z.uuid(),
  month: MonthSchema,
  category: BudgetCategorySchema,
  /** 80: «Te estás acercando»; 100: «Superaste el presupuesto». */
  threshold: z.union([z.literal(80), z.literal(100)]),
  spent: z.int().min(0),
  limit: z.int().min(BUDGET_LIMIT_MIN),
  createdAt: z.iso.datetime(),
  seen: z.boolean(),
});
export type BudgetAlert = z.infer<typeof BudgetAlertSchema>;

export const BudgetAlertListSchema = z.object({ items: z.array(BudgetAlertSchema) });
export type BudgetAlertList = z.infer<typeof BudgetAlertListSchema>;
