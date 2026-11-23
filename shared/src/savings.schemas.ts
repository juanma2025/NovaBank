/**
 * Esquemas de la API de metas de ahorro (spec 005). Cada esquema corresponde a un
 * `components.schemas` de specs/005-metas-ahorro/contracts/savings.openapi.json.
 */
import { z } from 'zod';

import { MovementSchema, MovementsQuerySchema } from './accounts.schemas.js';
import { MoneyAmountSchema } from './money.js';
import {
  GOAL_NAME_MAX_LENGTH,
  isValidIsoDate,
  SAVINGS_TARGET_MAX,
  SAVINGS_TARGET_MIN,
} from './savings.js';

/** `AAAA-MM-DD` válida. Que sea hoy o futura lo valida el backend con su reloj (research R8). */
export const IsoDateSchema = z
  .string()
  .refine(isValidIsoDate, 'Usa una fecha válida con el formato AAAA-MM-DD');

const GoalNameSchema = z.string().trim().min(1).max(GOAL_NAME_MAX_LENGTH);
const TargetAmountSchema = z.int().min(SAVINGS_TARGET_MIN).max(SAVINGS_TARGET_MAX);

export const GoalStatusSchema = z.enum(['active', 'closed']);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const GoalSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(GOAL_NAME_MAX_LENGTH),
  targetAmount: TargetAmountSchema,
  targetDate: IsoDateSchema.nullable(),
  balance: z.int().min(0),
  /** balance ≥ targetAmount (FR-004). */
  completed: z.boolean(),
  status: GoalStatusSchema,
  createdAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const GoalListSchema = z.object({
  items: z.array(GoalSchema),
  /** Suma de los saldos de las metas activas (FR-006). */
  totalSaved: z.int().min(0),
});
export type GoalList = z.infer<typeof GoalListSchema>;

export const CreateGoalRequestSchema = z.strictObject({
  name: GoalNameSchema,
  targetAmount: TargetAmountSchema,
  targetDate: IsoDateSchema.nullable().optional(),
});
export type CreateGoalRequest = z.infer<typeof CreateGoalRequestSchema>;

/** Al menos un campo; `targetDate: null` quita la fecha (FR-005). */
export const UpdateGoalRequestSchema = z
  .strictObject({
    name: GoalNameSchema.optional(),
    targetAmount: TargetAmountSchema.optional(),
    targetDate: IsoDateSchema.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Envía al menos un campo');
export type UpdateGoalRequest = z.infer<typeof UpdateGoalRequestSchema>;

export const SavingsAmountRequestSchema = z.strictObject({ amount: MoneyAmountSchema });
export type SavingsAmountRequest = z.infer<typeof SavingsAmountRequestSchema>;

export const SavingsMovementResultSchema = z.object({
  goal: GoalSchema,
  /** Visto desde la cuenta principal. */
  movement: MovementSchema,
  availableBalance: z.int().min(0),
});
export type SavingsMovementResult = z.infer<typeof SavingsMovementResultSchema>;

export const CloseGoalResultSchema = z.object({
  goal: GoalSchema,
  /** La devolución vista desde la cuenta principal; null si la meta no tenía saldo. */
  movement: MovementSchema.nullable(),
  availableBalance: z.int().min(0),
});
export type CloseGoalResult = z.infer<typeof CloseGoalResultSchema>;

export const SavingsLimitsSchema = z.object({
  minAmount: MoneyAmountSchema,
  maxAmount: MoneyAmountSchema,
  dailyLimit: MoneyAmountSchema,
  remainingToday: z.int().min(0),
});
export type SavingsLimits = z.infer<typeof SavingsLimitsSchema>;

/** Parámetros de `GET /savings/goals/{goalId}/movements` (iguales al historial de la spec 002). */
export const GoalMovementsQuerySchema = MovementsQuerySchema;
export type GoalMovementsQuery = z.infer<typeof GoalMovementsQuerySchema>;
