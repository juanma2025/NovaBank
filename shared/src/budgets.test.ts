import { describe, expect, it } from 'vitest';

import {
  addMonths,
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  bogotaMonth,
  budgetStatus,
  isValidMonth,
} from './budgets.js';

describe('meses', () => {
  it('bogotaMonth cambia a las 00:00 de Bogotá del día 1', () => {
    // 04:59 UTC del 1 de diciembre es todavía 30 de noviembre en Bogotá (UTC−5).
    expect(bogotaMonth(new Date('2026-12-01T04:59:00Z'))).toBe('2026-11');
    expect(bogotaMonth(new Date('2026-12-01T05:00:00Z'))).toBe('2026-12');
  });

  it('addMonths cruza años en ambos sentidos', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-03', -6)).toBe('2025-09');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-11', 0)).toBe('2026-11');
  });

  it('isValidMonth exige AAAA-MM con mes 01–12', () => {
    expect(isValidMonth('2026-11')).toBe(true);
    for (const value of ['2026-13', '2026-00', '2026-1', '11-2026', '2026-11-01']) {
      expect(isValidMonth(value), value).toBe(false);
    }
  });
});

describe('budgetStatus', () => {
  it('sin tope: sin porcentaje', () => {
    expect(budgetStatus(5000, null)).toEqual({ percent: null, status: 'none' });
  });

  it('ok bajo el 80 %, warning del 80 % hasta el tope exacto, exceeded al pasarlo', () => {
    expect(budgetStatus(7999, 10_000)).toEqual({ percent: 79, status: 'ok' });
    expect(budgetStatus(8000, 10_000)).toEqual({ percent: 80, status: 'warning' });
    expect(budgetStatus(10_000, 10_000)).toEqual({ percent: 100, status: 'warning' });
    expect(budgetStatus(10_001, 10_000)).toEqual({ percent: 100, status: 'exceeded' });
    expect(budgetStatus(25_000, 10_000)).toEqual({ percent: 250, status: 'exceeded' });
  });
});

describe('categorías', () => {
  it('cada categoría tiene nombre para mostrar', () => {
    expect(Object.keys(BUDGET_CATEGORY_LABELS)).toEqual([...BUDGET_CATEGORIES]);
  });
});
