/** Spec 004 · criptografía de la tarjeta (tasks.md T010; research R2 y R3). */
import { isValidCardNumber } from '@nova/shared';
import { describe, expect, it } from 'vitest';

import { createCardCrypto, generatePan } from '../../src/lib/card-crypto.js';

const KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const OTHER_KEY = 'f'.repeat(64);
const crypto = createCardCrypto(KEY);

describe('generatePan', () => {
  it('genera 16 dígitos con prefijo 9 y Luhn válido, distintos entre sí', () => {
    const pans = Array.from({ length: 200 }, generatePan);
    for (const pan of pans) {
      expect(pan).toMatch(/^9\d{15}$/);
      expect(isValidCardNumber(pan)).toBe(true);
    }
    expect(new Set(pans).size).toBe(pans.length);
  });
});

describe('cifrado del número', () => {
  it('ida y vuelta, con un IV distinto cada vez y sin el número en claro', () => {
    const pan = generatePan();
    const a = crypto.encryptPan(pan);
    const b = crypto.encryptPan(pan);
    expect(crypto.decryptPan(a)).toBe(pan);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(Buffer.from(a).toString('latin1')).not.toContain(pan);
  });

  it('un texto cifrado alterado o una clave distinta fallan', () => {
    const encrypted = crypto.encryptPan(generatePan());
    const tampered = Uint8Array.from(encrypted);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    expect(() => crypto.decryptPan(tampered)).toThrow();
    expect(() => createCardCrypto(OTHER_KEY).decryptPan(encrypted)).toThrow();
  });

  it('rechaza una clave que no tiene 32 bytes', () => {
    expect(() => createCardCrypto('abcd')).toThrow(/32 bytes/);
  });
});

describe('HMAC de búsqueda y CVV', () => {
  it('panHash es estable, de 64 caracteres y depende de la clave', () => {
    const pan = generatePan();
    expect(crypto.panHash(pan)).toMatch(/^[0-9a-f]{64}$/);
    expect(crypto.panHash(pan)).toBe(crypto.panHash(pan));
    expect(createCardCrypto(OTHER_KEY).panHash(pan)).not.toBe(crypto.panHash(pan));
  });

  it('el CVV tiene 3 dígitos, es estable para la misma tarjeta y cambia entre tarjetas', () => {
    const card = {
      id: '7b0e4c1a-3f2d-4e5b-9a8c-1d2e3f4a5b6c',
      pan: generatePan(),
      expMonth: 11,
      expYear: 2030,
    };
    const cvv = crypto.deriveCvv(card);
    expect(cvv).toMatch(/^\d{3}$/);
    expect(crypto.deriveCvv(card)).toBe(cvv);
    const others = Array.from({ length: 50 }, () =>
      crypto.deriveCvv({ ...card, pan: generatePan() }),
    );
    expect(new Set(others).size).toBeGreaterThan(30);
    // Con otra clave cambia (se comparan 10 tarjetas: una coincidencia aislada es posible, 1 en 1000).
    const other = createCardCrypto(OTHER_KEY);
    const sample = Array.from({ length: 10 }, () => ({ ...card, pan: generatePan() }));
    expect(sample.some((c) => other.deriveCvv(c) !== crypto.deriveCvv(c))).toBe(true);
  });
});
