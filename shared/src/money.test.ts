import { describe, expect, it } from 'vitest';

import { MoneyAmountSchema, SignedMoneySchema, formatCOP, parseCOPInput } from './money.js';

/** Intl usa un espacio duro entre «$» y el número; se normaliza para comparar. */
const plain = (s: string): string => s.replace(/\s/g, ' ');

describe('formatCOP', () => {
  it('usa el formato colombiano sin decimales', () => {
    expect(plain(formatCOP(1_250_000))).toBe('$ 1.250.000');
    expect(plain(formatCOP(0))).toBe('$ 0');
    expect(plain(formatCOP(50_000))).toBe('$ 50.000');
  });

  it('muestra el signo de los negativos', () => {
    expect(plain(formatCOP(-20_000))).toBe('-$ 20.000');
  });
});

describe('parseCOPInput', () => {
  it.each([
    ['50000', 50_000],
    ['50.000', 50_000],
    ['$50.000', 50_000],
    [' $ 1.000.000 ', 1_000_000],
    ['1000', 1_000],
  ])('«%s» → %i', (text, expected) => {
    expect(parseCOPInput(text)).toBe(expected);
  });

  it.each([
    '',
    'abc',
    '50,5',
    '50.5',
    '-1000',
    '1.00.000',
    '12.3456',
    '$',
    '1e5',
    '99999999999999999999',
  ])('rechaza «%s»', (text) => {
    expect(parseCOPInput(text)).toBeNull();
  });
});

describe('esquemas de dinero', () => {
  it('MoneyAmountSchema exige enteros positivos seguros', () => {
    expect(MoneyAmountSchema.safeParse(1).success).toBe(true);
    for (const bad of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(MoneyAmountSchema.safeParse(bad).success, String(bad)).toBe(false);
    }
  });

  it('SignedMoneySchema acepta signos pero no 0 ni decimales', () => {
    expect(SignedMoneySchema.safeParse(-50_000).success).toBe(true);
    expect(SignedMoneySchema.safeParse(50_000).success).toBe(true);
    expect(SignedMoneySchema.safeParse(0).success).toBe(false);
    expect(SignedMoneySchema.safeParse(10.5).success).toBe(false);
  });
});
