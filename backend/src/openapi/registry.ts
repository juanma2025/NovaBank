import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type ResponseConfig,
} from '@asteasolutions/zod-to-openapi';
import {
  CompleteRegistrationRequestSchema,
  ErrorResponseSchema,
  LoginRequestSchema,
  SessionResponseSchema,
  StartRegistrationRequestSchema,
  VerificationStateSchema,
  VerifyCodeRequestSchema,
} from '@nova/shared';
import { z } from 'zod';

/**
 * Documento OpenAPI generado desde los esquemas de @nova/shared (research R12). Debe coincidir
 * con specs/001-auth-onboarding/contracts/auth.openapi.json (prueba de contrato).
 * Cada historia de usuario registra aquí sus operaciones al implementarlas.
 */
export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();
  // Sin registry.register(): exige `.openapi()` sobre los esquemas, y zod-to-openapi se carga en
  // su versión CommonJS con otra copia de Zod. Los esquemas quedan en línea en el documento.
  const error = ErrorResponseSchema;
  const state = VerificationStateSchema;
  const session = SessionResponseSchema;

  const json = (schema: z.ZodType, description: string): ResponseConfig => ({
    description,
    content: { 'application/json': { schema } },
  });
  const err = (description: string): ResponseConfig => json(error, description);
  const body = (schema: z.ZodType) => ({
    body: { required: true, content: { 'application/json': { schema } } },
  });

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

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'Nova API', version: '1.0.0' },
    servers: [{ url: '/api/v1' }],
  });
}
