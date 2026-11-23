import { formatCOP, isValidCardNumber, type PaymentLimits } from '@nova/shared';

import { STORE_MESSAGES } from '../../../lib/messages.ts';

export const EXPIRY_REGEX = /^(0[1-9]|1[0-2])\/\d{2}$/;
export const CVV_REGEX = /^\d{3}$/;

export function validateStoreAmount(
  raw: string,
  parsed: number | null,
  limits: PaymentLimits | undefined,
  balance: number | undefined,
): string | undefined {
  if (raw.trim() === '') return STORE_MESSAGES.validationAmountRequired;
  if (parsed === null) return STORE_MESSAGES.validationAmountInvalid;
  if (limits) {
    if (parsed < limits.minAmount || parsed > limits.maxAmount) {
      return STORE_MESSAGES.validationAmountRange(
        formatCOP(limits.minAmount),
        formatCOP(limits.maxAmount),
      );
    }
    if (parsed > limits.remainingToday) {
      return limits.remainingToday <= 0
        ? STORE_MESSAGES.dailyLimitReached
        : STORE_MESSAGES.validationExceedsRemaining(formatCOP(limits.remainingToday));
    }
  }
  if (balance !== undefined && parsed > balance) {
    return STORE_MESSAGES.validationInsufficientFunds(formatCOP(balance));
  }
  return undefined;
}

export function isStoreCardFormValid(cardNumber: string, expiry: string, cvv: string): boolean {
  return isValidCardNumber(cardNumber) && EXPIRY_REGEX.test(expiry) && CVV_REGEX.test(cvv);
}
