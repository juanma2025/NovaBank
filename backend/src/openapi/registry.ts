import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type ResponseConfig,
} from '@asteasolutions/zod-to-openapi';
import {
  AccountSummarySchema,
  BudgetAlertListSchema,
  BudgetAlertSchema,
  BudgetCategorySchema,
  BudgetMonthQuerySchema,
  BudgetMonthSchema,
  BudgetTransferSchema,
  BudgetTransfersPageSchema,
  BudgetTransfersQuerySchema,
  CardListSchema,
  CardNicknameRequestSchema,
  CardPaymentResultSchema,
  CardPaymentsPageSchema,
  CardPaymentsQuerySchema,
  CardSchema,
  CardSecretsSchema,
  CloseGoalResultSchema,
  CreateCardPaymentRequestSchema,
  CreateGoalRequestSchema,
  GoalListSchema,
  GoalMovementsQuerySchema,
  GoalSchema,
  CompletePasswordResetRequestSchema,
  CompleteRegistrationRequestSchema,
  CreateTopupRequestSchema,
  CreateTransferRequestSchema,
  ErrorResponseSchema,
  LoginRequestSchema,
  MovementsPageSchema,
  MovementsQuerySchema,
  PaymentLimitsSchema,
  ProfileSchema,
  RecipientPreviewSchema,
  RecipientQuerySchema,
  RevealCardRequestSchema,
  SavingsAmountRequestSchema,
  SavingsLimitsSchema,
  SavingsMovementResultSchema,
  SetBudgetLimitRequestSchema,
  SetTransferCategoryRequestSchema,
  SetAliasRequestSchema,
  SessionResponseSchema,
  StartPasswordResetRequestSchema,
  StartRegistrationRequestSchema,
  TopupLimitsSchema,
  TopupResultSchema,
  TransferLimitsSchema,
  TransferResultSchema,
  UpdateGoalRequestSchema,
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

  // --- Spec 002: cuentas y recargas ---------------------------------------
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

  // Spec 003 · US2: perfil y alias.
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

  // Spec 003 · US1: transferencias.
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

  // Spec 004: tarjetas y tienda demo.
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

  // Spec 005: metas de ahorro.
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

  // Spec 006: presupuesto.
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

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'Nova API', version: '1.0.0' },
    servers: [{ url: '/api/v1' }],
  });
}
