import { z } from 'zod';

import { EMAIL_MAX_LENGTH } from './constants.js';

/**
 * Normaliza un correo: sin espacios al inicio o al final y en minúsculas.
 * data-model.md `User.email` («normalizado»); spec, caso límite «Mayúsculas y espacios».
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Devuelve el dominio (después de la última `@`) de un correo ya normalizado. */
export function emailDomain(normalizedEmail: string): string {
  return normalizedEmail.slice(normalizedEmail.lastIndexOf('@') + 1);
}

/**
 * Correo con formato válido, normalizado antes de validar.
 * La lista de dominios permitidos NO se valida aquí: es configuración del backend (FR-001).
 */
export const InstitutionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(EMAIL_MAX_LENGTH));
