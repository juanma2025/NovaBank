import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  BudgetAlertListSchema,
  BudgetAlertSchema,
  BudgetCategorySchema,
  BudgetMonthQuerySchema,
  BudgetMonthSchema,
  BudgetTransferSchema,
  BudgetTransfersPageSchema,
  BudgetTransfersQuerySchema,
  SetBudgetLimitRequestSchema,
  SetTransferCategoryRequestSchema,
} from '@nova/shared';
import { z } from 'zod';

import type { PathHelpers } from '../helpers.js';

/** Spec 006: presupuesto (contrato en specs/; prueba de contrato del backend). */
export function registerBudgetsPaths(registry: OpenAPIRegistry, helpers: PathHelpers): void {
  const { json, err, body } = helpers;
  const categoryParams = { params: z.object({ category: BudgetCategorySchema }) };

  registry.registerPath({
    method: 'get',
    path: '/budgets',
    operationId: 'getBudgetMonth',
    request: { query: BudgetMonthQuerySchema },
    responses: {
      200: json(BudgetMonthSchema, 'Resumen'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/budgets/limits/{category}',
    operationId: 'setBudgetLimit',
    request: { ...categoryParams, ...body(SetBudgetLimitRequestSchema) },
    responses: {
      200: json(BudgetMonthSchema, 'Resumen del mes actual'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/budgets/limits/{category}',
    operationId: 'removeBudgetLimit',
    request: categoryParams,
    responses: {
      200: json(BudgetMonthSchema, 'Resumen del mes actual'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/budgets/transfers',
    operationId: 'listBudgetTransfers',
    request: { query: BudgetTransfersQuerySchema },
    responses: {
      200: json(BudgetTransfersPageSchema, 'Página de transferencias'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/budgets/transfers/{transactionId}/category',
    operationId: 'setTransferCategory',
    request: {
      params: z.object({ transactionId: z.uuid() }),
      ...body(SetTransferCategoryRequestSchema),
    },
    responses: {
      200: json(BudgetTransferSchema, 'Transferencia con su categoría'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      404: err('NOT_FOUND'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/budgets/alerts',
    operationId: 'listBudgetAlerts',
    responses: { 200: json(BudgetAlertListSchema, 'Alertas'), 401: err('Sesión inválida') },
  });

  registry.registerPath({
    method: 'post',
    path: '/budgets/alerts/{alertId}/seen',
    operationId: 'markBudgetAlertSeen',
    request: { params: z.object({ alertId: z.uuid() }) },
    responses: {
      200: json(BudgetAlertSchema, 'Alerta vista'),
      401: err('Sesión inválida'),
      404: err('NOT_FOUND'),
    },
  });
}
