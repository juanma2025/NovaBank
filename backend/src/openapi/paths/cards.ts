import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  CardListSchema,
  CardNicknameRequestSchema,
  CardPaymentResultSchema,
  CardPaymentsPageSchema,
  CardPaymentsQuerySchema,
  CardSchema,
  CardSecretsSchema,
  CreateCardPaymentRequestSchema,
  PaymentLimitsSchema,
  RevealCardRequestSchema,
} from '@nova/shared';
import { z } from 'zod';

import type { PathHelpers } from '../helpers.js';

/** Spec 004: tarjetas y tienda demo (contrato en specs/; prueba de contrato del backend). */
export function registerCardsPaths(registry: OpenAPIRegistry, helpers: PathHelpers): void {
  const { json, err, body } = helpers;
  const cardParams = { params: z.object({ cardId: z.uuid() }) };
  const notFound = err('NOT_FOUND');
  const canceled = err('CARD_CANCELED');

  registry.registerPath({
    method: 'get',
    path: '/cards',
    operationId: 'listMyCards',
    responses: { 200: json(CardListSchema, 'Tarjetas'), 401: err('Sesión inválida') },
  });

  registry.registerPath({
    method: 'post',
    path: '/cards',
    operationId: 'issueCard',
    request: body(CardNicknameRequestSchema),
    responses: {
      201: json(CardSchema, 'Tarjeta emitida'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      422: err('CARD_LIMIT_REACHED'),
      429: err('RATE_LIMITED'),
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/cards/{cardId}',
    operationId: 'renameCard',
    request: { ...cardParams, ...body(CardNicknameRequestSchema) },
    responses: {
      200: json(CardSchema, 'Tarjeta actualizada'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      404: notFound,
      409: canceled,
    },
  });

  for (const [action, operationId] of [
    ['freeze', 'freezeCard'],
    ['unfreeze', 'unfreezeCard'],
    ['cancel', 'cancelCard'],
  ] as const) {
    registry.registerPath({
      method: 'post',
      path: `/cards/{cardId}/${action}`,
      operationId,
      request: cardParams,
      responses: {
        200: json(CardSchema, 'Tarjeta con su estado actual'),
        401: err('Sesión inválida'),
        404: notFound,
        409: canceled,
      },
    });
  }

  registry.registerPath({
    method: 'post',
    path: '/cards/{cardId}/reveal',
    operationId: 'revealCard',
    request: { ...cardParams, ...body(RevealCardRequestSchema) },
    responses: {
      200: json(CardSecretsSchema, 'Datos completos (Cache-Control: no-store)'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      404: notFound,
      409: canceled,
      422: err('REAUTH_FAILED'),
      429: err('REAUTH_LOCKED o RATE_LIMITED'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/cards/{cardId}/payments',
    operationId: 'listCardPayments',
    request: { ...cardParams, query: CardPaymentsQuerySchema },
    responses: {
      200: json(CardPaymentsPageSchema, 'Página de pagos'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      404: notFound,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/store/limits',
    operationId: 'getPaymentLimits',
    responses: { 200: json(PaymentLimitsSchema, 'Límites'), 401: err('Sesión inválida') },
  });

  registry.registerPath({
    method: 'post',
    path: '/store/payments',
    operationId: 'createCardPayment',
    request: body(CreateCardPaymentRequestSchema),
    responses: {
      201: json(CardPaymentResultSchema, 'Pago aprobado'),
      400: err('VALIDATION_ERROR'),
      401: err('Sesión inválida'),
      409: err('IDEMPOTENCY_KEY_REUSED'),
      422: err(
        'CARD_DECLINED, CARD_NOT_ACTIVE, PAYMENT_AMOUNT_OUT_OF_RANGE, PAYMENT_DAILY_LIMIT o INSUFFICIENT_FUNDS',
      ),
      429: err('CARD_PAYMENTS_LOCKED o RATE_LIMITED'),
    },
  });
}
