import { z } from 'zod';

/**
 * Utilidades de dinero (constitución, Principio I; spec 002 research R9). Los montos son pesos
 * colombianos ENTEROS: nunca punto flotante.
 */

/** Monto positivo en pesos enteros (ej. una recarga). */
export const MoneyAmountSchema = z.int().min(1).max(Number.MAX_SAFE_INTEGER);

/** Monto con signo, distinto de 0 (movimiento visto desde una cuenta: + entra, − sale). */
export const SignedMoneySchema = z
  .int()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)
  .refine((n) => n !== 0, 'el monto no puede ser 0');

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** «$ 1.250.000» con el formato colombiano, sin decimales. */
export function formatCOP(amount: number): string {
  return copFormatter.format(amount);
}

/**
 * Lee un monto escrito por el usuario: acepta «50000», «50.000», «$50.000» y espacios.
 * Devuelve el entero o `null` si hay decimales, signo negativo, letras o no es un entero seguro.
 */
export function parseCOPInput(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(/^\$/, '');
  if (cleaned === '') return null;
  // Solo dígitos, con puntos como separadores de miles bien formados (1.000.000).
  if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(cleaned)) return null;
  const value = Number(cleaned.replaceAll('.', ''));
  return Number.isSafeInteger(value) ? value : null;
}
