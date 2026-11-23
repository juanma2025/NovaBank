import { describe, expect, it } from 'vitest';

import { CreateSplitRequestSchema, PayShareRequestSchema } from './splits.schemas.js';

const recipientId = '7b0e4c1a-3f2d-4e5b-9a8c-1d2e3f4a5b6c';
const split = {
  title: 'Cena de cumpleaños',
  totalAmount: 90_000,
  creatorShare: 30_000,
  shares: [
    { recipientId, amount: 30_000 },
    { recipientId: '8c1f5d2b-4a3e-4f6c-8b9d-2e3f4a5b6c7d', amount: 30_000 },
  ],
};

describe('CreateSplitRequestSchema', () => {
  it('acepta una división válida y recorta el título', () => {
    expect(CreateSplitRequestSchema.parse({ ...split, title: '  Cena  ' }).title).toBe('Cena');
  });

  it.each([
    ['título vacío', { title: '   ' }],
    ['título largo', { title: 'x'.repeat(61) }],
    ['total bajo', { totalAmount: 1999 }],
    ['total alto', { totalAmount: 5_000_001 }],
    ['parte propia negativa', { creatorShare: -1 }],
    ['sin participantes', { shares: [] }],
    [
      '11 participantes',
      { shares: Array.from({ length: 11 }, () => ({ recipientId, amount: 1000 })) },
    ],
    ['parte en cero', { shares: [{ recipientId, amount: 0 }] }],
    ['participante sin uuid', { shares: [{ recipientId: 'x', amount: 1000 }] }],
    ['campo extra', { extra: 1 }],
  ])('rechaza %s', (_name, change) => {
    expect(CreateSplitRequestSchema.safeParse({ ...split, ...change }).success).toBe(false);
  });
});

describe('PayShareRequestSchema', () => {
  it('la contraseña es opcional y no admite otros campos', () => {
    expect(PayShareRequestSchema.safeParse({}).success).toBe(true);
    expect(PayShareRequestSchema.safeParse({ password: 'clave' }).success).toBe(true);
    expect(PayShareRequestSchema.safeParse({ password: '' }).success).toBe(false);
    expect(PayShareRequestSchema.safeParse({ amount: 1000 }).success).toBe(false);
  });
});
