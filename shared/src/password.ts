import { z } from 'zod';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './constants.js';
import { normalizeEmail } from './email.js';
import type { PasswordRuleViolation } from './errors.js';

/**
 * Longitud de la contraseña (FR-010; data-model.md, sección «Validación» de `User`).
 * Las reglas que dependen del correo y de la lista común se aplican aparte.
 */
export const PasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

/**
 * Reglas de contraseña que se pueden comprobar en el cliente y en el servidor (FR-010, R10):
 * longitud y que no contenga el correo ni su parte local (comparación sin mayúsculas).
 * La regla `common` (lista de contraseñas comunes) solo la aplica el backend.
 */
export function validatePasswordRules(
  password: string,
  email: string,
): Exclude<PasswordRuleViolation, 'common'>[] {
  const violations: Exclude<PasswordRuleViolation, 'common'>[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) violations.push('too_short');
  if (password.length > PASSWORD_MAX_LENGTH) violations.push('too_long');

  const normalized = normalizeEmail(email);
  const localPart = normalized.split('@')[0] ?? '';
  const lowerPassword = password.toLowerCase();
  if (
    normalized.length > 0 &&
    (lowerPassword.includes(normalized) ||
      (localPart.length > 0 && lowerPassword.includes(localPart)))
  ) {
    violations.push('contains_email');
  }

  return violations;
}
