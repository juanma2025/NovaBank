import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  CreateTransferRequestSchema,
  ProfileSchema,
  RecipientPreviewSchema,
  RecipientQuerySchema,
  SetAliasRequestSchema,
  TransferLimitsSchema,
  TransferResultSchema,
} from '@nova/shared';

import type { PathHelpers } from '../helpers.js';

/** Spec 003: perfil, alias y transferencias (contrato en specs/; prueba de contrato del backend). */
export function registerTransfersPaths(registry: OpenAPIRegistry, helpers: PathHelpers): void {
  const { json, err, body } = helpers;
  registry.registerPath({
    method: 'get',
    path: '/profile/me',
    operationId: 'getMyProfile',
    responses: { 200: json(ProfileSchema, 'Perfil'), 401: err('Sesión inválida') },
  });

  registry.registerPath({
    method: 'put',
    path: '/profile/me/alias',
    operationId: 'setMyAlias',
    request: body(SetAliasRequestSchema),
    responses: {
      200: json(ProfileSchema, 'Perfil actualizado'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      409: err('ALIAS_TAKEN'),
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/profile/me/alias',
    operationId: 'removeMyAlias',
    responses: { 200: json(ProfileSchema, 'Perfil actualizado'), 401: err('Sesión inválida') },
  });

  registry.registerPath({
    method: 'get',
    path: '/transfers/recipient',
    operationId: 'findRecipient',
    request: { query: RecipientQuerySchema },
    responses: {
      200: json(RecipientPreviewSchema, 'Destinatario'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      404: err('RECIPIENT_NOT_FOUND'),
      422: err('TRANSFER_TO_SELF'),
      429: err('RATE_LIMITED'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/transfers/limits',
    operationId: 'getTransferLimits',
    responses: { 200: json(TransferLimitsSchema, 'Límites'), 401: err('Sesión inválida') },
  });

  registry.registerPath({
    method: 'post',
    path: '/transfers',
    operationId: 'createTransfer',
    request: body(CreateTransferRequestSchema),
    responses: {
      201: json(TransferResultSchema, 'Transferencia aplicada'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      404: err('RECIPIENT_NOT_FOUND'),
      409: err('IDEMPOTENCY_KEY_REUSED'),
      422: err(
        'TRANSFER_TO_SELF, TRANSFER_AMOUNT_OUT_OF_RANGE, TRANSFER_DAILY_LIMIT, INSUFFICIENT_FUNDS, REAUTH_REQUIRED o REAUTH_FAILED',
      ),
      429: err('REAUTH_LOCKED o RATE_LIMITED'),
    },
  });
}
