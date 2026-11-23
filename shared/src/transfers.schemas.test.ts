import { describe, expect, it } from 'vitest';

import {
  AliasSchema,
  CreateTransferRequestSchema,
  RecipientQuerySchema,
  SetAliasRequestSchema,
} from './transfers.schemas.js';

const recipientId = '7b0e4c1a-3f2d-4e5b-9a8c-1d2e3f4a5b6c';

describe('AliasSchema', () => {
  it('normaliza: recorta, quita la @ y pasa a minúsculas', () => {
    expect(AliasSchema.parse('@Ana.Perez')).toBe('ana.perez');
    expect(AliasSchema.parse('  juan_99 ')).toBe('juan_99');
    expect(AliasSchema.parse('abc')).toBe('abc');
    expect(AliasSchema.parse('a'.repeat(20))).toBe('a'.repeat(20));
    expect(AliasSchema.parse(`@${'a'.repeat(20)}`)).toBe('a'.repeat(20));
  });

  it.each(['.ab', 'ab_', 'a', 'ab', 'con espacio', 'ñandu', 'josé', '@', 'a'.repeat(21), 'a@b'])(
    'rechaza «%s»',
    (value) => {
      expect(AliasSchema.safeParse(value).success).toBe(false);
    },
  );

  it('SetAliasRequest es estricto', () => {
    expect(SetAliasRequestSchema.parse({ alias: '@B.Prueba' })).toEqual({ alias: 'b.prueba' });
    expect(SetAliasRequestSchema.safeParse({ alias: 'b.prueba', extra: 1 }).success).toBe(false);
  });
});

describe('RecipientQuerySchema', () => {
  it('acepta un correo o un alias y rechaza textos cortos', () => {
    expect(RecipientQuerySchema.parse({ q: ' ana@ucc.edu.co ' }).q).toBe('ana@ucc.edu.co');
    expect(RecipientQuerySchema.safeParse({ q: '@a' }).success).toBe(false);
  });
});

describe('CreateTransferRequestSchema', () => {
  it('acepta lo mínimo y con nota y contraseña', () => {
    expect(CreateTransferRequestSchema.safeParse({ recipientId, amount: 15000 }).success).toBe(
      true,
    );
    expect(
      CreateTransferRequestSchema.safeParse({
        recipientId,
        amount: 250000,
        note: 'almuerzo',
        password: 'una clave larga',
      }).success,
    ).toBe(true);
    expect(
      CreateTransferRequestSchema.safeParse({ recipientId, amount: 1000, note: null }).success,
    ).toBe(true);
  });

  it('rechaza campos extra, notas largas, montos no enteros y contraseñas vacías', () => {
    const base = { recipientId, amount: 15000 };
    expect(CreateTransferRequestSchema.safeParse({ ...base, alias: 'x' }).success).toBe(false);
    expect(CreateTransferRequestSchema.safeParse({ ...base, note: 'x'.repeat(141) }).success).toBe(
      false,
    );
    expect(CreateTransferRequestSchema.safeParse({ ...base, amount: 15000.5 }).success).toBe(false);
    expect(CreateTransferRequestSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(CreateTransferRequestSchema.safeParse({ ...base, password: '' }).success).toBe(false);
    expect(CreateTransferRequestSchema.safeParse({ ...base, recipientId: 'x' }).success).toBe(
      false,
    );
  });
});
