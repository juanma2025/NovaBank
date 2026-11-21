import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { type PasswordRuleViolation, validatePasswordRules } from '@nova/shared';
import argon2 from 'argon2';

let commonPasswords: Set<string> | null = null;

/** Lista de contraseñas comunes (research R10), cargada una vez en memoria. */
function loadCommonPasswords(): Set<string> {
  if (commonPasswords) return commonPasswords;
  const file = fileURLToPath(new URL('./data/common-passwords.txt', import.meta.url));
  commonPasswords = new Set(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0 && !line.startsWith('#')),
  );
  return commonPasswords;
}

/** Reglas compartidas de @nova/shared + lista común (FR-010). */
export function checkPassword(password: string, email: string): PasswordRuleViolation[] {
  const violations: PasswordRuleViolation[] = validatePasswordRules(password, email);
  if (loadCommonPasswords().has(password.toLowerCase())) violations.push('common');
  return violations;
}

/** Hash Argon2id con los parámetros por defecto de la librería (Principio III). */
export const hashPassword = (password: string): Promise<string> =>
  argon2.hash(password, { type: argon2.argon2id });

export const verifyPassword = (hash: string, password: string): Promise<boolean> =>
  argon2.verify(hash, password);
