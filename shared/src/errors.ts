import { z } from 'zod';

/** Códigos de error estables de la API (contrato: `components.schemas.ErrorCode`). */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'DOMAIN_NOT_ALLOWED',
  'POLICY_VERSION_OUTDATED',
  'VERIFICATION_NOT_FOUND',
  'VERIFICATION_STEP_INVALID',
  'VERIFICATION_EXPIRED',
  'CODE_INVALID',
  'CODE_EXPIRED',
  'CODE_ATTEMPTS_EXHAUSTED',
  'RESEND_TOO_SOON',
  'CODE_SEND_LIMIT',
  'PASSWORD_WEAK',
  'EMAIL_ALREADY_REGISTERED',
  'INVALID_CREDENTIALS',
  'LOGIN_LOCKED',
  'UNAUTHENTICATED',
  'ACCESS_TOKEN_EXPIRED',
  'SESSION_EXPIRED',
  'RATE_LIMITED',
  'NOT_FOUND',
  'INTERNAL_ERROR',
  // Spec 002
  'TOPUP_AMOUNT_OUT_OF_RANGE',
  'TOPUP_DAILY_LIMIT',
  'IDEMPOTENCY_KEY_REUSED',
  // Spec 003
  'ALIAS_TAKEN',
  'RECIPIENT_NOT_FOUND',
  'TRANSFER_TO_SELF',
  'TRANSFER_AMOUNT_OUT_OF_RANGE',
  'TRANSFER_DAILY_LIMIT',
  'INSUFFICIENT_FUNDS',
  'REAUTH_REQUIRED',
  'REAUTH_FAILED',
  'REAUTH_LOCKED',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** Reglas de contraseña incumplidas que puede reportar la API. */
export const PasswordRuleViolationSchema = z.enum([
  'too_short',
  'too_long',
  'contains_email',
  'common',
]);
export type PasswordRuleViolation = z.infer<typeof PasswordRuleViolationSchema>;

/** Motivo de cierre de una sesión expirada. */
export const SessionEndReasonSchema = z.enum(['idle', 'absolute', 'revoked']);
export type SessionEndReason = z.infer<typeof SessionEndReasonSchema>;

/**
 * Datos opcionales para que la interfaz reaccione (constitución v2.3.0, formato de error).
 * Nunca contiene datos sensibles ni revela la existencia de cuentas.
 */
export const ErrorDetailsSchema = z.object({
  attemptsLeft: z.int().min(0).optional(),
  retryAfterSeconds: z.int().min(1).optional(),
  reason: SessionEndReasonSchema.optional(),
  reasons: z.array(PasswordRuleViolationSchema).optional(),
  fields: z.record(z.string(), z.string()).optional(),
  // Spec 002: límites de recarga (también de transferencia en la 003).
  minAmount: z.int().min(1).optional(),
  maxAmount: z.int().min(1).optional(),
  remainingToday: z.int().min(0).optional(),
  // Spec 003: saldo disponible y umbral de reautenticación.
  availableBalance: z.int().min(0).optional(),
  reauthThreshold: z.int().min(1).optional(),
});
export type ErrorDetails = z.infer<typeof ErrorDetailsSchema>;

/** Formato uniforme de error (contrato: `components.schemas.ErrorResponse`). */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.uuid(),
    details: ErrorDetailsSchema.optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
