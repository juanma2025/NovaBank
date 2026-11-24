import { describe, expect, it } from 'vitest';

import { safeRedirect } from '../src/lib/safe-redirect.ts';

describe('safeRedirect', () => {
  it('permite rutas internas válidas con query y hash', () => {
    expect(safeRedirect('/inicio')).toBe('/inicio');
    expect(safeRedirect('/inicio?tab=movimientos#ultimo')).toBe('/inicio?tab=movimientos#ultimo');
    expect(safeRedirect('/')).toBe('/');
    expect(safeRedirect('  /privacidad  ')).toBe('/privacidad');
  });

  it('rechaza valores vacíos o nulos y devuelve el destino por defecto', () => {
    expect(safeRedirect(null)).toBe('/inicio');
    expect(safeRedirect(undefined)).toBe('/inicio');
    expect(safeRedirect('')).toBe('/inicio');
    expect(safeRedirect('   ')).toBe('/inicio');
    expect(safeRedirect(null, '/ingresar')).toBe('/ingresar');
  });

  it('rechaza URLs absolutas, protocol-relative, barras invertidas y esquemas', () => {
    expect(safeRedirect('https://evil.example/phish')).toBe('/inicio');
    expect(safeRedirect('http://localhost:5173/inicio')).toBe('/inicio');
    expect(safeRedirect('//evil.example/inicio')).toBe('/inicio');
    expect(safeRedirect('/\\evil.example')).toBe('/inicio');
    expect(safeRedirect('/inicio\\otro')).toBe('/inicio');
    expect(safeRedirect('javascript:alert(1)')).toBe('/inicio');
    expect(safeRedirect('inicio')).toBe('/inicio');
    expect(safeRedirect('/inicio\nSet-Cookie: a=b')).toBe('/inicio');
  });
});
