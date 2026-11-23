import { describe, expect, it } from 'vitest';

import {
  AccountSummarySchema,
  CreateTopupRequestSchema,
  MovementSchema,
  MovementsPageSchema,
  MovementsQuerySchema,
  TopupLimitsSchema,
  TopupResultSchema,
} from './accounts.schemas.js';

const movement = {
  id: '7c3e1f0a-2b4d-4c6e-8f10-1a2b3c4d5e6f',
  transactionId: '8d4f2a1b-3c5e-4d7f-9a21-2b3c4d5e6f70',
  type: 'topup',
  description: 'Recarga simulada',
  amount: 50_000,
  status: 'completed',
  createdAt: '2026-11-22T15:00:00Z',
};

describe('esquemas de la spec 002', () => {
  it('Movement acepta el ejemplo y exige monto entero distinto de 0', () => {
    expect(MovementSchema.safeParse(movement).success).toBe(true);
    expect(MovementSchema.safeParse({ ...movement, amount: 0 }).success).toBe(false);
    expect(MovementSchema.safeParse({ ...movement, amount: 10.5 }).success).toBe(false);
    expect(MovementSchema.safeParse({ ...movement, status: 'aprobada' }).success).toBe(false);
  });

  it('AccountSummary limita los recientes a 5 y no admite saldo negativo', () => {
    const base = { id: movement.id, currency: 'COP', balance: 50_000, recentMovements: [movement] };
    expect(AccountSummarySchema.safeParse(base).success).toBe(true);
    expect(AccountSummarySchema.safeParse({ ...base, balance: -1 }).success).toBe(false);
    expect(
      AccountSummarySchema.safeParse({ ...base, recentMovements: Array(6).fill(movement) }).success,
    ).toBe(false);
    expect(AccountSummarySchema.safeParse({ ...base, currency: 'USD' }).success).toBe(false);
  });

  it('MovementsPage acepta nextCursor nulo', () => {
    expect(MovementsPageSchema.safeParse({ items: [movement], nextCursor: null }).success).toBe(
      true,
    );
  });

  it('MovementsQuery aplica el valor por defecto, convierte texto y respeta los límites', () => {
    expect(MovementsQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(MovementsQuerySchema.parse({ limit: '5', cursor: 'abc' })).toEqual({
      limit: 5,
      cursor: 'abc',
    });
    for (const limit of ['0', '21', 'x']) {
      expect(MovementsQuerySchema.safeParse({ limit }).success, limit).toBe(false);
    }
    expect(MovementsQuerySchema.safeParse({ otro: '1' }).success).toBe(false);
  });

  it('CreateTopupRequest exige un entero positivo y rechaza campos extra', () => {
    expect(CreateTopupRequestSchema.safeParse({ amount: 50_000 }).success).toBe(true);
    for (const body of [{ amount: 0 }, { amount: 1.5 }, { amount: '50000' }, { amount: 1, x: 1 }]) {
      expect(CreateTopupRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
    }
  });

  it('TopupLimits y TopupResult', () => {
    expect(
      TopupLimitsSchema.safeParse({
        minAmount: 1_000,
        maxAmount: 500_000,
        dailyLimit: 2_000_000,
        remainingToday: 0,
      }).success,
    ).toBe(true);
    expect(TopupResultSchema.safeParse({ movement, balance: 50_000 }).success).toBe(true);
  });
});
