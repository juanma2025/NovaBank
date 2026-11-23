import { describe, expect, it } from 'vitest';

import {
  CreateGoalRequestSchema,
  SavingsAmountRequestSchema,
  UpdateGoalRequestSchema,
} from './savings.schemas.js';

const goal = { name: 'Viaje a Santa Marta', targetAmount: 600_000, targetDate: '2027-06-15' };

describe('CreateGoalRequestSchema', () => {
  it('recorta el nombre y acepta la fecha opcional o null', () => {
    expect(CreateGoalRequestSchema.parse({ ...goal, name: '  Viaje  ' }).name).toBe('Viaje');
    expect(CreateGoalRequestSchema.safeParse({ name: 'Viaje', targetAmount: 1000 }).success).toBe(
      true,
    );
    expect(CreateGoalRequestSchema.safeParse({ ...goal, targetDate: null }).success).toBe(true);
  });

  it.each([
    ['nombre vacío', { name: '   ' }],
    ['nombre largo', { name: 'x'.repeat(41) }],
    ['objetivo bajo', { targetAmount: 999 }],
    ['objetivo alto', { targetAmount: 100_000_001 }],
    ['objetivo decimal', { targetAmount: 1000.5 }],
    ['fecha inexistente', { targetDate: '2026-02-30' }],
    ['fecha con otro formato', { targetDate: '15/06/2027' }],
    ['campo extra', { extra: 1 }],
  ])('rechaza %s', (_name, change) => {
    expect(CreateGoalRequestSchema.safeParse({ ...goal, ...change }).success).toBe(false);
  });
});

describe('UpdateGoalRequestSchema', () => {
  it('acepta un solo campo y null para quitar la fecha', () => {
    expect(UpdateGoalRequestSchema.safeParse({ name: 'Otro' }).success).toBe(true);
    expect(UpdateGoalRequestSchema.parse({ targetDate: null })).toEqual({ targetDate: null });
  });

  it('rechaza una actualización vacía o con campos extra', () => {
    expect(UpdateGoalRequestSchema.safeParse({}).success).toBe(false);
    expect(UpdateGoalRequestSchema.safeParse({ status: 'closed' }).success).toBe(false);
  });
});

describe('SavingsAmountRequestSchema', () => {
  it('exige un entero positivo y nada más', () => {
    expect(SavingsAmountRequestSchema.safeParse({ amount: 50_000 }).success).toBe(true);
    for (const body of [{ amount: 0 }, { amount: 10.5 }, { amount: 1000, goalId: 'x' }]) {
      expect(SavingsAmountRequestSchema.safeParse(body).success).toBe(false);
    }
  });
});
