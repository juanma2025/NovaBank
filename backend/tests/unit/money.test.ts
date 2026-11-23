import { describe, expect, it } from 'vitest';

import { startOfBogotaDay } from '../../src/lib/bogota-day.js';
import { toSafeNumber } from '../../src/lib/money.js';

describe('toSafeNumber (Principio I)', () => {
  it('convierte bigint a number entero', () => {
    expect(toSafeNumber(50_000n)).toBe(50_000);
    expect(toSafeNumber(-20_000n)).toBe(-20_000);
    expect(toSafeNumber(0n)).toBe(0);
  });

  it('falla si el valor no es un entero seguro', () => {
    expect(() => toSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(/enteros seguros/);
  });
});

describe('startOfBogotaDay (topes diarios en hora de Colombia)', () => {
  it('a las 23:59 de Bogotá sigue siendo el mismo día', () => {
    // 2026-11-22 23:59 en Bogotá = 2026-11-23 04:59 UTC.
    expect(startOfBogotaDay(new Date('2026-11-23T04:59:00Z')).toISOString()).toBe(
      '2026-11-22T05:00:00.000Z',
    );
  });

  it('a las 00:00 de Bogotá empieza un día nuevo', () => {
    expect(startOfBogotaDay(new Date('2026-11-23T05:00:00Z')).toISOString()).toBe(
      '2026-11-23T05:00:00.000Z',
    );
  });

  it('a mediodía UTC corresponde al día de Bogotá', () => {
    expect(startOfBogotaDay(new Date('2026-11-22T12:00:00Z')).toISOString()).toBe(
      '2026-11-22T05:00:00.000Z',
    );
  });
});
