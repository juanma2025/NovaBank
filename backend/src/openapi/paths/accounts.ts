import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  AccountSummarySchema,
  CreateTopupRequestSchema,
  MovementsPageSchema,
  MovementsQuerySchema,
  TopupLimitsSchema,
  TopupResultSchema,
} from '@nova/shared';

import type { PathHelpers } from '../helpers.js';

/** Spec 002: cuentas, movimientos y recargas (contrato en specs/; prueba de contrato del backend). */
export function registerAccountsPaths(registry: OpenAPIRegistry, helpers: PathHelpers): void {
  const { json, err, body } = helpers;
  registry.registerPath({
    method: 'get',
    path: '/accounts/me',
    operationId: 'getMyAccount',
    responses: {
      200: json(AccountSummarySchema, 'Cuenta del estudiante'),
      401: err('Sesión inválida'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/accounts/me/movements',
    operationId: 'listMyMovements',
    request: { query: MovementsQuerySchema },
    responses: {
      200: json(MovementsPageSchema, 'Página de movimientos'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/topups/limits',
    operationId: 'getTopupLimits',
    responses: { 200: json(TopupLimitsSchema, 'Límites vigentes'), 401: err('Sesión inválida') },
  });

  registry.registerPath({
    method: 'post',
    path: '/topups',
    operationId: 'createTopup',
    request: body(CreateTopupRequestSchema),
    responses: {
      201: json(TopupResultSchema, 'Recarga aplicada'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      409: err('IDEMPOTENCY_KEY_REUSED'),
      422: err('TOPUP_AMOUNT_OUT_OF_RANGE o TOPUP_DAILY_LIMIT'),
      429: err('RATE_LIMITED'),
    },
  });
}
