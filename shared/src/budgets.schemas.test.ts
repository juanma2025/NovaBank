import { describe, expect, it } from 'vitest';

import {
  BudgetMonthQuerySchema,
  BudgetTransfersQuerySchema,
  SetBudgetLimitRequestSchema,
  SetTransferCategoryRequestSchema,
} from './budgets.schemas.js';

describe('SetBudgetLimitRequestSchema', () => {
  it('acepta enteros entre $1.000 y $50.000.000', () => {
    expect(SetBudgetLimitRequestSchema.safeParse({ monthlyLimit: 1000 }).success).toBe(true);
    expect(SetBudgetLimitRequestSchema.safeParse({ monthlyLimit: 50_000_000 }).success).toBe(true);
  });

  it.each([
    ['bajo', { monthlyLimit: 999 }],
    ['alto', { monthlyLimit: 50_000_001 }],
    ['decimal', { monthlyLimit: 1000.5 }],
    ['campo extra', { monthlyLimit: 1000, category: 'food' }],
  ])('rechaza un tope %s', (_name, body) => {
    expect(SetBudgetLimitRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe('consultas y categorías', () => {
  it('el mes es opcional y debe ser AAAA-MM', () => {
    expect(BudgetMonthQuerySchema.parse({})).toEqual({});
    expect(BudgetMonthQuerySchema.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(BudgetMonthQuerySchema.safeParse({ month: '2026-11', extra: '1' }).success).toBe(false);
  });

  it('las transferencias se paginan como el historial', () => {
    expect(BudgetTransfersQuerySchema.parse({ month: '2026-11' })).toEqual({
      month: '2026-11',
      limit: 20,
    });
    expect(BudgetTransfersQuerySchema.safeParse({ limit: '21' }).success).toBe(false);
  });

  it('solo categorías del presupuesto', () => {
    expect(SetTransferCategoryRequestSchema.safeParse({ category: 'other' }).success).toBe(true);
    expect(SetTransferCategoryRequestSchema.safeParse({ category: 'rent' }).success).toBe(false);
  });
});
