import { describe, expect, it } from 'vitest';

import { PasswordSchema, validatePasswordRules } from './password.js';

const EMAIL = 'ana.perez@ucc.edu.co';

describe('validatePasswordRules (FR-010)', () => {
  it('acepta una contraseña válida', () => {
    expect(validatePasswordRules('Cafe con arepa 2026', EMAIL)).toEqual([]);
  });

  it('marca too_short por debajo de 10 caracteres', () => {
    expect(validatePasswordRules('corta123', EMAIL)).toEqual(['too_short']);
    expect(validatePasswordRules('a'.repeat(9), EMAIL)).toEqual(['too_short']);
    expect(validatePasswordRules('a'.repeat(10), EMAIL)).toEqual([]);
  });

  it('marca too_long por encima de 128 caracteres', () => {
    expect(validatePasswordRules('a'.repeat(128), EMAIL)).toEqual([]);
    expect(validatePasswordRules('a'.repeat(129), EMAIL)).toEqual(['too_long']);
  });

  it('marca contains_email si contiene el correo completo', () => {
    expect(validatePasswordRules(`x${EMAIL}x`, EMAIL)).toContain('contains_email');
  });

  it('marca contains_email si contiene la parte local, sin distinguir mayúsculas', () => {
    expect(validatePasswordRules('Mi clave ANA.PEREZ 99', EMAIL)).toEqual(['contains_email']);
  });

  it('compara contra el correo normalizado', () => {
    expect(validatePasswordRules('ana.perez-segura-1', '  Ana.Perez@UCC.edu.co ')).toEqual([
      'contains_email',
    ]);
  });

  it('puede reportar varias reglas a la vez', () => {
    expect(validatePasswordRules('ana.perez', EMAIL)).toEqual(['too_short', 'contains_email']);
  });
});

describe('PasswordSchema', () => {
  it('aplica los límites de longitud', () => {
    expect(PasswordSchema.safeParse('a'.repeat(9)).success).toBe(false);
    expect(PasswordSchema.safeParse('a'.repeat(10)).success).toBe(true);
    expect(PasswordSchema.safeParse('a'.repeat(128)).success).toBe(true);
    expect(PasswordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
});
