import { describe, expect, it } from 'vitest';

import {
  CardNicknameRequestSchema,
  CardSecretsSchema,
  CreateCardPaymentRequestSchema,
} from './cards.schemas.js';

const payment = {
  merchantId: 'cafeteria-central',
  amount: 12_000,
  cardNumber: '9012 3456 7890 1234',
  expiry: '11/30',
  cvv: '123',
};

describe('CardNicknameRequestSchema', () => {
  it('recorta espacios y limita a 1–30 caracteres', () => {
    expect(CardNicknameRequestSchema.parse({ nickname: '  Compras  ' })).toEqual({
      nickname: 'Compras',
    });
    expect(CardNicknameRequestSchema.safeParse({ nickname: '   ' }).success).toBe(false);
    expect(CardNicknameRequestSchema.safeParse({ nickname: 'x'.repeat(31) }).success).toBe(false);
    expect(CardNicknameRequestSchema.safeParse({ nickname: 'ok', extra: 1 }).success).toBe(false);
  });
});

describe('CreateCardPaymentRequestSchema', () => {
  it('acepta el número con espacios y lo devuelve sin ellos', () => {
    expect(CreateCardPaymentRequestSchema.parse(payment).cardNumber).toBe('9012345678901234');
    expect(
      CreateCardPaymentRequestSchema.parse({ ...payment, cardNumber: '9012345678901234' })
        .cardNumber,
    ).toBe('9012345678901234');
  });

  it.each([
    ['vencimiento 13/30', { expiry: '13/30' }],
    ['vencimiento sin barra', { expiry: '1130' }],
    ['CVV de 4 dígitos', { cvv: '1234' }],
    ['número corto', { cardNumber: '9012 3456 7890' }],
    ['número con letras', { cardNumber: '9012 3456 7890 12a4' }],
    ['comercio desconocido', { merchantId: 'otro' }],
    ['monto decimal', { amount: 10.5 }],
    ['campo extra', { extra: true }],
  ])('rechaza %s', (_name, change) => {
    expect(CreateCardPaymentRequestSchema.safeParse({ ...payment, ...change }).success).toBe(false);
  });
});

describe('CardSecretsSchema', () => {
  it('exige 16 dígitos que empiezan por 9 y un CVV de 3', () => {
    const secrets = { number: '9012345678901234', expMonth: 11, expYear: 2030, cvv: '042' };
    expect(CardSecretsSchema.safeParse(secrets).success).toBe(true);
    expect(CardSecretsSchema.safeParse({ ...secrets, number: '4111111111111111' }).success).toBe(
      false,
    );
  });
});
