import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  CompletePasswordResetRequestSchema,
  CompleteRegistrationRequestSchema,
  LoginRequestSchema,
  SessionResponseSchema,
  StartPasswordResetRequestSchema,
  StartRegistrationRequestSchema,
  VerificationStateSchema,
  VerifyCodeRequestSchema,
} from '@nova/shared';
import { z } from 'zod';

import type { PathHelpers } from '../helpers.js';

/** Spec 001: salud, registro, verificación, sesión y recuperación (contrato en specs/; prueba de contrato del backend). */
export function registerAuthPaths(registry: OpenAPIRegistry, helpers: PathHelpers): void {
  const { json, err, body } = helpers;
  const state = VerificationStateSchema;
  const session = SessionResponseSchema;

  registry.registerPath({
    method: 'get',
    path: '/health',
    operationId: 'getHealth',
    responses: { 200: json(z.object({ status: z.literal('ok') }), 'Servicio disponible') },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/register',
    operationId: 'startRegistration',
    request: body(StartRegistrationRequestSchema),
    responses: {
      202: json(state, 'Flujo creado'),
      400: err('VALIDATION_ERROR'),
      422: err('DOMAIN_NOT_ALLOWED o POLICY_VERSION_OUTDATED'),
      429: err('CODE_SEND_LIMIT o RATE_LIMITED'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/auth/verification',
    operationId: 'getVerification',
    responses: { 200: json(state, 'Flujo vigente'), 404: err('VERIFICATION_NOT_FOUND') },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/verify-email',
    operationId: 'verifyEmail',
    request: body(VerifyCodeRequestSchema),
    responses: {
      200: json(state, 'Código correcto'),
      400: err('VALIDATION_ERROR'),
      404: err('VERIFICATION_NOT_FOUND'),
      409: err('VERIFICATION_STEP_INVALID'),
      422: err('CODE_INVALID, CODE_EXPIRED o CODE_ATTEMPTS_EXHAUSTED'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/resend-verification',
    operationId: 'resendVerification',
    responses: {
      202: json(state, 'Código nuevo encolado'),
      404: err('VERIFICATION_NOT_FOUND'),
      409: err('VERIFICATION_STEP_INVALID'),
      429: err('RESEND_TOO_SOON, CODE_SEND_LIMIT o RATE_LIMITED'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/register/complete',
    operationId: 'completeRegistration',
    request: body(CompleteRegistrationRequestSchema),
    responses: {
      201: json(session, 'Cuenta creada y sesión iniciada'),
      400: err('VALIDATION_ERROR'),
      404: err('VERIFICATION_NOT_FOUND'),
      409: err('VERIFICATION_STEP_INVALID o EMAIL_ALREADY_REGISTERED'),
      422: err('VERIFICATION_EXPIRED o PASSWORD_WEAK'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/password-reset',
    operationId: 'startPasswordReset',
    request: body(StartPasswordResetRequestSchema),
    responses: {
      202: json(state, 'Flujo creado'),
      400: err('VALIDATION_ERROR'),
      429: err('CODE_SEND_LIMIT o RATE_LIMITED'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/password-reset/complete',
    operationId: 'completePasswordReset',
    request: body(CompletePasswordResetRequestSchema),
    responses: {
      204: { description: 'Contraseña cambiada' },
      400: err('VALIDATION_ERROR'),
      404: err('VERIFICATION_NOT_FOUND'),
      409: err('VERIFICATION_STEP_INVALID'),
      422: err('VERIFICATION_EXPIRED o PASSWORD_WEAK'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/login',
    operationId: 'login',
    request: body(LoginRequestSchema),
    responses: {
      200: json(session, 'Sesión iniciada'),
      400: err('VALIDATION_ERROR'),
      401: err('INVALID_CREDENTIALS'),
      429: err('LOGIN_LOCKED o RATE_LIMITED'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    operationId: 'refreshSession',
    responses: { 200: json(session, 'Sesión renovada'), 401: err('Sesión inválida') },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    operationId: 'logout',
    responses: { 204: { description: 'Sesión cerrada' } },
  });

  registry.registerPath({
    method: 'get',
    path: '/auth/session',
    operationId: 'getSession',
    responses: { 200: json(session, 'Sesión válida'), 401: err('Sesión inválida') },
  });
}
