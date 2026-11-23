import type { ErrorCode, ErrorDetails } from '@nova/shared';

import { ERROR_MESSAGES } from './error-messages.js';

/** Estado HTTP de cada código (constitución: mapeo canónico; contrato de la spec 001). */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  DOMAIN_NOT_ALLOWED: 422,
  POLICY_VERSION_OUTDATED: 422,
  VERIFICATION_NOT_FOUND: 404,
  VERIFICATION_STEP_INVALID: 409,
  VERIFICATION_EXPIRED: 422,
  CODE_INVALID: 422,
  CODE_EXPIRED: 422,
  CODE_ATTEMPTS_EXHAUSTED: 422,
  RESEND_TOO_SOON: 429,
  CODE_SEND_LIMIT: 429,
  PASSWORD_WEAK: 422,
  EMAIL_ALREADY_REGISTERED: 409,
  INVALID_CREDENTIALS: 401,
  LOGIN_LOCKED: 429,
  UNAUTHENTICATED: 401,
  ACCESS_TOKEN_EXPIRED: 401,
  SESSION_EXPIRED: 401,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
  // Spec 002
  TOPUP_AMOUNT_OUT_OF_RANGE: 422,
  TOPUP_DAILY_LIMIT: 422,
  IDEMPOTENCY_KEY_REUSED: 409,
  // Spec 003
  ALIAS_TAKEN: 409,
  RECIPIENT_NOT_FOUND: 404,
  TRANSFER_TO_SELF: 422,
  TRANSFER_AMOUNT_OUT_OF_RANGE: 422,
  TRANSFER_DAILY_LIMIT: 422,
  INSUFFICIENT_FUNDS: 422,
  REAUTH_REQUIRED: 422,
  REAUTH_FAILED: 422,
  REAUTH_LOCKED: 429,
  // Spec 004
  CARD_LIMIT_REACHED: 422,
  CARD_CANCELED: 409,
  CARD_NOT_ACTIVE: 422,
  CARD_DECLINED: 422,
  CARD_PAYMENTS_LOCKED: 429,
  PAYMENT_AMOUNT_OUT_OF_RANGE: 422,
  PAYMENT_DAILY_LIMIT: 422,
  // Spec 005
  GOAL_LIMIT_REACHED: 422,
  GOAL_CLOSED: 409,
  SAVINGS_AMOUNT_OUT_OF_RANGE: 422,
  SAVINGS_DAILY_LIMIT: 422,
  // Spec 007
  SPLIT_SHARES_MISMATCH: 422,
  SPLIT_SHARE_OUT_OF_RANGE: 422,
  SPLIT_CLOSED: 409,
  SHARE_NOT_PENDING: 409,
  SPLIT_REMINDER_TOO_SOON: 429,
};

/** Error de negocio con un código estable del contrato. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    readonly details?: ErrorDetails,
  ) {
    super(ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.status = ERROR_STATUS[code];
  }
}

export const appError = (code: ErrorCode, details?: ErrorDetails): AppError =>
  new AppError(code, details);
