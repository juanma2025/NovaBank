import { describe, expect, it } from 'vitest';

import {
  hmacSha256Hex,
  randomCode,
  randomToken,
  safeEqualHex,
  sha256Hex,
} from '../../src/lib/crypto.js';

describe('crypto (research R9)', () => {
  it('HMAC es determinista y depende de la clave', () => {
    expect(hmacSha256Hex('clave-a', 'flujo:123456')).toBe(hmacSha256Hex('clave-a', 'flujo:123456'));
    expect(hmacSha256Hex('clave-a', 'flujo:123456')).not.toBe(
      hmacSha256Hex('clave-b', 'flujo:123456'),
    );
    expect(hmacSha256Hex('k', 'v')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('safeEqualHex compara en tiempo constante y rechaza longitudes distintas o vacías', () => {
    const a = sha256Hex('a');
    expect(safeEqualHex(a, sha256Hex('a'))).toBe(true);
    expect(safeEqualHex(a, sha256Hex('b'))).toBe(false);
    expect(safeEqualHex(a, a.slice(0, 10))).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
  });

  it('randomCode da 6 dígitos, con ceros a la izquierda', () => {
    for (let i = 0; i < 200; i += 1) expect(randomCode()).toMatch(/^\d{6}$/);
  });

  it('randomToken es opaco y no se repite', () => {
    const tokens = new Set(Array.from({ length: 50 }, randomToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
