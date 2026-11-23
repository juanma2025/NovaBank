import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  CloseGoalResultSchema,
  CreateGoalRequestSchema,
  GoalListSchema,
  GoalMovementsQuerySchema,
  GoalSchema,
  MovementsPageSchema,
  SavingsAmountRequestSchema,
  SavingsLimitsSchema,
  SavingsMovementResultSchema,
  UpdateGoalRequestSchema,
} from '@nova/shared';
import { z } from 'zod';

import type { PathHelpers } from '../helpers.js';

/** Spec 005: metas de ahorro (contrato en specs/; prueba de contrato del backend). */
export function registerSavingsPaths(registry: OpenAPIRegistry, helpers: PathHelpers): void {
  const { json, err, body } = helpers;
  const goalParams = { params: z.object({ goalId: z.uuid() }) };

  registry.registerPath({
    method: 'get',
    path: '/savings/goals',
    operationId: 'listMyGoals',
    responses: { 200: json(GoalListSchema, 'Metas'), 401: err('Sesión inválida') },
  });

  registry.registerPath({
    method: 'post',
    path: '/savings/goals',
    operationId: 'createGoal',
    request: body(CreateGoalRequestSchema),
    responses: {
      201: json(GoalSchema, 'Meta creada'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      422: err('GOAL_LIMIT_REACHED'),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/savings/goals/{goalId}',
    operationId: 'updateGoal',
    request: { ...goalParams, ...body(UpdateGoalRequestSchema) },
    responses: {
      200: json(GoalSchema, 'Meta actualizada'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      404: err('NOT_FOUND'),
      409: err('GOAL_CLOSED'),
    },
  });

  for (const [action, operationId] of [
    ['deposits', 'depositToGoal'],
    ['withdrawals', 'withdrawFromGoal'],
  ] as const) {
    registry.registerPath({
      method: 'post',
      path: `/savings/goals/{goalId}/${action}`,
      operationId,
      request: { ...goalParams, ...body(SavingsAmountRequestSchema) },
      responses: {
        201: json(SavingsMovementResultSchema, 'Movimiento aplicado'),
        400: err('VALIDATION_ERROR'),
        401: err('Sesión inválida'),
        404: err('NOT_FOUND'),
        409: err('GOAL_CLOSED o IDEMPOTENCY_KEY_REUSED'),
        422: err('SAVINGS_AMOUNT_OUT_OF_RANGE, SAVINGS_DAILY_LIMIT o INSUFFICIENT_FUNDS'),
        429: err('RATE_LIMITED'),
      },
    });
  }

  registry.registerPath({
    method: 'post',
    path: '/savings/goals/{goalId}/close',
    operationId: 'closeGoal',
    request: goalParams,
    responses: {
      200: json(CloseGoalResultSchema, 'Meta cerrada'),
      401: err('Sesión inválida'),
      404: err('NOT_FOUND'),
      409: err('GOAL_CLOSED o IDEMPOTENCY_KEY_REUSED'),
      429: err('RATE_LIMITED'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/savings/goals/{goalId}/movements',
    operationId: 'listGoalMovements',
    request: { ...goalParams, query: GoalMovementsQuerySchema },
    responses: {
      200: json(MovementsPageSchema, 'Historial de la meta'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      404: err('NOT_FOUND'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/savings/limits',
    operationId: 'getSavingsLimits',
    responses: { 200: json(SavingsLimitsSchema, 'Límites'), 401: err('Sesión inválida') },
  });
}
