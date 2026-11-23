/**
 * Reglas puras del presupuesto mensual (spec 006, research R3, R7 y R8). El frontend y el backend usan
 * las mismas categorías, meses y estados.
 */
import { z } from 'zod';

import type { MerchantCategory } from './cards.js';
import { bogotaToday } from './savings.js';

/** Las 5 de comercios de la spec 004, más «Transferencias» y «Otros» (FR-001). */
export const BUDGET_CATEGORIES = [
  'food',
  'books',
  'transport',
  'stationery',
  'entertainment',
  'transfers',
  'other',
] as const;
export const BudgetCategorySchema = z.enum(BUDGET_CATEGORIES);
export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

/** Nombres para mostrar (pantallas y correo de alerta). */
export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  food: 'Comida',
  books: 'Libros',
  transport: 'Transporte',
  stationery: 'Papelería',
  entertainment: 'Entretenimiento',
  transfers: 'Transferencias',
  other: 'Otros',
};

/** Cada categoría de comercio es una categoría del presupuesto con el mismo nombre (FR-002). */
export function merchantToBudgetCategory(category: MerchantCategory): BudgetCategory {
  return category;
}

export const BUDGET_LIMIT_MIN = 1000;
export const BUDGET_LIMIT_MAX = 50_000_000;
/** Meses anteriores consultables además del actual (FR-007). */
export const BUDGET_HISTORY_MONTHS = 6;
/** Umbrales de alerta (FR-009). */
export const BUDGET_WARNING_PERCENT = 80;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `AAAA-MM` válido. */
export function isValidMonth(value: string): boolean {
  return MONTH.test(value);
}

/** Mes calendario de `now` en Bogotá como `AAAA-MM`. */
export function bogotaMonth(now: Date): string {
  return bogotaToday(now).slice(0, 7);
}

/** `month` desplazado `n` meses (n puede ser negativo). */
export function addMonths(month: string, n: number): string {
  const [, y = '0', m = '01'] = MONTH.exec(month) ?? [];
  const total = Number(y) * 12 + (Number(m) - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export type BudgetStatus = 'none' | 'ok' | 'warning' | 'exceeded';

/**
 * Porcentaje (entero hacia abajo; puede pasar de 100) y estado de una categoría (research R7).
 * Llegar exactamente al tope es `warning`; `exceeded` es pasarlo.
 */
export function budgetStatus(
  spent: number,
  limit: number | null,
): { percent: number | null; status: BudgetStatus } {
  if (limit === null) return { percent: null, status: 'none' };
  const percent = Math.floor((spent * 100) / limit);
  if (spent > limit) return { percent, status: 'exceeded' };
  if (percent >= BUDGET_WARNING_PERCENT) return { percent, status: 'warning' };
  return { percent, status: 'ok' };
}
