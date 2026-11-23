import { CardSchema, CardSecretsSchema, type Card, type CardSecrets } from '@nova/shared';
import { expect } from 'vitest';

import type { TestApp } from './test-app.js';
import { IDEMPOTENCY, type TestUser, createUserWithSession, newKey } from './users.js';

export const CARD_PASSWORD = 'una clave bastante larga';

/** Estudiante con contraseña real (para ver los datos) y nombre conocido. */
export function createCardholder(t: TestApp, prefix: string): Promise<TestUser> {
  return createUserWithSession(t, prefix, { fullName: 'Ana Pérez Gómez', password: CARD_PASSWORD });
}

/** Recarga en partes de hasta $50.000 (máximo por recarga en las pruebas). */
export async function fund(user: TestUser, amount: number): Promise<void> {
  for (let left = amount; left > 0; left -= 50_000) {
    const res = await user.agent.post(
      '/api/v1/topups',
      { amount: Math.min(left, 50_000) },
      { [IDEMPOTENCY]: newKey() },
    );
    expect(res.status).toBe(201);
  }
}

export async function issueCard(user: TestUser, nickname = 'Compras'): Promise<Card> {
  const res = await user.agent.post('/api/v1/cards', { nickname });
  expect(res.status).toBe(201);
  return CardSchema.parse(res.body);
}

export async function revealCard(user: TestUser, cardId: string): Promise<CardSecrets> {
  const res = await user.agent.post(`/api/v1/cards/${cardId}/reveal`, {
    password: CARD_PASSWORD,
  });
  expect(res.status).toBe(200);
  return CardSecretsSchema.parse(res.body);
}

export const expiryOf = (s: { expMonth: number; expYear: number }): string =>
  `${String(s.expMonth).padStart(2, '0')}/${String(s.expYear % 100).padStart(2, '0')}`;

/** Cuerpo de pago con los datos de la tarjeta. */
export function paymentBody(
  secrets: CardSecrets,
  amount: number,
  merchantId = 'cafeteria-central',
) {
  return {
    merchantId,
    amount,
    cardNumber: secrets.number,
    expiry: expiryOf(secrets),
    cvv: secrets.cvv,
  };
}

export function pay(user: TestUser, body: object, key = newKey()) {
  return user.agent.post('/api/v1/store/payments', body, { [IDEMPOTENCY]: key });
}

export async function balanceOf(user: TestUser): Promise<number> {
  return (await user.agent.get('/api/v1/accounts/me')).body.balance as number;
}
