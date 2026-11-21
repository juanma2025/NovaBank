import { describe, expect, it } from 'vitest';

import { InstitutionalEmailSchema, emailDomain, normalizeEmail } from './email.js';

describe('normalizeEmail', () => {
  it('quita espacios y pasa a minúsculas (caso límite «Mayúsculas y espacios»)', () => {
    expect(normalizeEmail('  Ana.Perez@UCC.edu.co ')).toBe('ana.perez@ucc.edu.co');
  });

  it('trata como el mismo correo las variantes con mayúsculas y espacios', () => {
    expect(normalizeEmail('Ana.Perez@UCC.edu.co ')).toBe(normalizeEmail('ana.perez@ucc.edu.co'));
  });
});

describe('emailDomain', () => {
  it('devuelve el dominio exacto, incluidos subdominios', () => {
    expect(emailDomain('ana@ucc.edu.co')).toBe('ucc.edu.co');
    expect(emailDomain('ana@campus.ucc.edu.co')).toBe('campus.ucc.edu.co');
  });
});

describe('InstitutionalEmailSchema', () => {
  it('normaliza antes de validar', () => {
    expect(InstitutionalEmailSchema.parse('  Ana.Perez@UCC.edu.co ')).toBe('ana.perez@ucc.edu.co');
  });

  it('rechaza formatos inválidos', () => {
    for (const value of ['', 'ana', 'ana@', '@ucc.edu.co', 'ana perez@ucc.edu.co']) {
      expect(InstitutionalEmailSchema.safeParse(value).success).toBe(false);
    }
  });

  it('rechaza correos de más de 254 caracteres (data-model.md User.email)', () => {
    const longLocal = 'a'.repeat(64);
    const longDomain = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.${'e'.repeat(60)}.co`;
    const email = `${longLocal}@${longDomain}`;
    expect(email.length).toBeGreaterThan(254);
    expect(InstitutionalEmailSchema.safeParse(email).success).toBe(false);
  });

  it('no valida la lista de dominios (eso lo hace el backend con su configuración)', () => {
    expect(InstitutionalEmailSchema.safeParse('ana@gmail.com').success).toBe(true);
  });
});
