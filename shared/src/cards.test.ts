import { describe, expect, it } from 'vitest';

import {
  DEMO_MERCHANTS,
  findMerchant,
  isValidCardNumber,
  luhnCheckDigit,
  maskCardNumber,
  MerchantIdSchema,
  normalizeCardNumber,
} from './cards.js';

describe('Luhn', () => {
  it('calcula el dígito de control de números conocidos', () => {
    // Números de prueba públicos (no reales): 4111 1111 1111 1111 y 7992 7398 713.
    expect(luhnCheckDigit('411111111111111')).toBe(1);
    expect(luhnCheckDigit('7992739871')).toBe(3);
  });

  it('isValidCardNumber exige 16 dígitos y Luhn correcto, con o sin espacios', () => {
    const base = '901234567890123';
    const valid = `${base}${luhnCheckDigit(base)}`;
    expect(isValidCardNumber(valid)).toBe(true);
    expect(isValidCardNumber(valid.replace(/(\d{4})/g, '$1 ').trim())).toBe(true);
    const wrong = `${base}${(luhnCheckDigit(base) + 1) % 10}`;
    expect(isValidCardNumber(wrong)).toBe(false);
    expect(isValidCardNumber('123')).toBe(false);
    expect(isValidCardNumber('abcd efgh ijkl mnop')).toBe(false);
  });

  it('rechaza entradas que no son dígitos', () => {
    expect(() => luhnCheckDigit('12a')).toThrow();
  });
});

describe('utilidades', () => {
  it('normaliza y enmascara', () => {
    expect(normalizeCardNumber(' 9012 3456\t7890 1234 ')).toBe('9012345678901234');
    expect(maskCardNumber('1234')).toBe('•••• 1234');
  });

  it('los comercios tienen id único y se encuentran por id', () => {
    const ids = DEMO_MERCHANTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(MerchantIdSchema.options).toEqual(ids);
    expect(findMerchant('cafeteria-central')).toMatchObject({ category: 'food' });
  });
});
