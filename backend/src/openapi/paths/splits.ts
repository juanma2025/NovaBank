import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  CreateSplitRequestSchema,
  PayShareRequestSchema,
  PayShareResultSchema,
  SplitSchema,
  SplitsPageSchema,
  SplitsQuerySchema,
  SplitsSummarySchema,
} from '@nova/shared';
import { z } from 'zod';

import type { PathHelpers } from '../helpers.js';

/** Spec 007: gastos compartidos (contrato en specs/; prueba de contrato del backend). */
export function registerSplitsPaths(registry: OpenAPIRegistry, helpers: PathHelpers): void {
  const { json, err, body } = helpers;
  const splitParams = { params: z.object({ splitId: z.uuid() }) };
  const shareParams = { params: z.object({ splitId: z.uuid(), shareId: z.uuid() }) };
  const splitOk = json(SplitSchema, 'División actualizada');
  const splitNotFound = err('NOT_FOUND');
  const splitConflict = err('SPLIT_CLOSED o SHARE_NOT_PENDING');

  registry.registerPath({
    method: 'get',
    path: '/splits',
    operationId: 'listMySplits',
    request: { query: SplitsQuerySchema },
    responses: {
      200: json(SplitsPageSchema, 'Página'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/splits',
    operationId: 'createSplit',
    request: body(CreateSplitRequestSchema),
    responses: {
      201: json(SplitSchema, 'División abierta'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      404: err('RECIPIENT_NOT_FOUND'),
      422: err('SPLIT_SHARES_MISMATCH o SPLIT_SHARE_OUT_OF_RANGE'),
      429: err('RATE_LIMITED'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/splits/summary',
    operationId: 'getSplitsSummary',
    responses: { 200: json(SplitsSummarySchema, 'Resumen'), 401: err('Sesión inválida') },
  });

  registry.registerPath({
    method: 'get',
    path: '/splits/{splitId}',
    operationId: 'getSplit',
    request: splitParams,
    responses: {
      200: json(SplitSchema, 'División'),
      401: err('Sesión inválida'),
      404: splitNotFound,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/splits/{splitId}/cancel',
    operationId: 'cancelSplit',
    request: splitParams,
    responses: {
      200: splitOk,
      401: err('Sesión inválida'),
      404: splitNotFound,
      409: err('SPLIT_CLOSED'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/splits/{splitId}/shares/me/pay',
    operationId: 'paySplitShare',
    request: { ...splitParams, ...body(PayShareRequestSchema) },
    responses: {
      201: json(PayShareResultSchema, 'Parte pagada'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      404: splitNotFound,
      409: err('SPLIT_CLOSED, SHARE_NOT_PENDING o IDEMPOTENCY_KEY_REUSED'),
      422: err('Errores de transferencia (spec 003)'),
      429: err('REAUTH_LOCKED o RATE_LIMITED'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/splits/{splitId}/shares/me/decline',
    operationId: 'declineSplitShare',
    request: splitParams,
    responses: {
      200: splitOk,
      401: err('Sesión inválida'),
      404: splitNotFound,
      409: splitConflict,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/splits/{splitId}/shares/{shareId}/mark-paid',
    operationId: 'markSplitSharePaid',
    request: shareParams,
    responses: {
      200: splitOk,
      401: err('Sesión inválida'),
      404: splitNotFound,
      409: splitConflict,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/splits/{splitId}/shares/{shareId}/remind',
    operationId: 'remindSplitShare',
    request: shareParams,
    responses: {
      200: splitOk,
      401: err('Sesión inválida'),
      404: splitNotFound,
      409: splitConflict,
      429: err('SPLIT_REMINDER_TOO_SOON'),
    },
  });
}
