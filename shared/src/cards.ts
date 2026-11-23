/**
 * Utilidades puras de la tarjeta virtual y comercios de la tienda demo (spec 004, research R2 y R5).
 */
import { z } from 'zod';

export const CARD_NUMBER_LENGTH = 16;
export const CARD_NICKNAME_MAX_LENGTH = 30;
export const MAX_ACTIVE_CARDS = 3;
/** Los datos completos se ocultan solos tras este tiempo (FR-009). */
export const CARD_SECRETS_VISIBLE_SECONDS = 60;

export const MerchantCategorySchema = z.enum([
  'food',
  'books',
  'transport',
  'stationery',
  'entertainment',
]);
export type MerchantCategory = z.infer<typeof MerchantCategorySchema>;

/** Comercios ficticios de la tienda demo (FR-011). Igual a `MerchantId` del contrato. */
export const DEMO_MERCHANTS = [
  { id: 'cafeteria-central', name: 'Cafetería Central', category: 'food' },
  { id: 'restaurante-la-u', name: 'Restaurante La U', category: 'food' },
  { id: 'libreria-campus', name: 'Librería del Campus', category: 'books' },
  { id: 'bus-universitario', name: 'Bus Universitario', category: 'transport' },
  { id: 'papeleria-express', name: 'Papelería Express', category: 'stationery' },
  { id: 'cine-estudiantil', name: 'Cine Estudiantil', category: 'entertainment' },
] as const satisfies readonly { id: string; name: string; category: MerchantCategory }[];

export type DemoMerchant = (typeof DEMO_MERCHANTS)[number];

export const MerchantIdSchema = z.enum(
  DEMO_MERCHANTS.map((m) => m.id) as [DemoMerchant['id'], ...DemoMerchant['id'][]],
);
export type MerchantId = z.infer<typeof MerchantIdSchema>;

export function findMerchant(id: MerchantId): DemoMerchant {
  const merchant = DEMO_MERCHANTS.find((m) => m.id === id);
  if (!merchant) throw new Error(`comercio desconocido: ${id}`);
  return merchant;
}

/** Quita espacios: «9012 3456 7890 1234» → «9012345678901234». */
export function normalizeCardNumber(value: string): string {
  return value.replace(/\s+/g, '');
}

/** Dígito de control Luhn para una cadena de dígitos sin el dígito final. */
export function luhnCheckDigit(digits: string): number {
  if (!/^\d+$/.test(digits)) throw new Error('solo dígitos');
  let sum = 0;
  // De derecha a izquierda, doblando la posición que quedará en lugar par al agregar el dígito.
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10;
}

/** 16 dígitos (con o sin espacios) y dígito de control Luhn correcto. */
export function isValidCardNumber(value: string): boolean {
  const number = normalizeCardNumber(value);
  if (!/^\d{16}$/.test(number)) return false;
  return luhnCheckDigit(number.slice(0, -1)) === Number(number.at(-1));
}

/** Vista estándar del número (regla de dominio 8): «•••• 1234». */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`;
}
