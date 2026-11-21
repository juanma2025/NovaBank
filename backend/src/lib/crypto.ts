import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { CODE_LENGTH } from '@nova/shared';

/** Token opaco aleatorio de 32 bytes en base64url (sesión, flujo, dispositivo). */
export const randomToken = (): string => randomBytes(32).toString('base64url');

export const sha256Hex = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex');

export const hmacSha256Hex = (secret: string, value: string): string =>
  createHmac('sha256', secret).update(value, 'utf8').digest('hex');

/** Compara dos hashes hexadecimales en tiempo constante. */
export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** Código numérico de 6 dígitos con `crypto.randomInt` (research R9). */
export const randomCode = (): string =>
  randomInt(0, 10 ** CODE_LENGTH)
    .toString()
    .padStart(CODE_LENGTH, '0');
