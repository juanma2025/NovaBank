/**
 * Esquemas de la API de tarjetas y tienda demo (spec 004). Cada esquema corresponde a un
 * `components.schemas` de specs/004-tarjeta-virtual/contracts/cards.openapi.json.
 */
import { z } from 'zod';

import { MovementSchema } from './accounts.schemas.js';
import {
  CARD_NICKNAME_MAX_LENGTH,
  MerchantCategorySchema,
  MerchantIdSchema,
  normalizeCardNumber,
} from './cards.js';
import { MOVEMENTS_PAGE_SIZE } from './constants.js';
import { MoneyAmountSchema } from './money.js';

const Last4Schema = z.string().regex(/^\d{4}$/);
const ExpMonthSchema = z.int().min(1).max(12);
const ExpYearSchema = z.int().min(2000).max(2999);

export const CardStatusSchema = z.enum(['active', 'frozen', 'canceled']);
export type CardStatus = z.infer<typeof CardStatusSchema>;

/** Vista estándar: nunca el número completo ni el CVV (regla de dominio 8). */
export const CardSchema = z.object({
  id: z.uuid(),
  nickname: z.string().min(1).max(CARD_NICKNAME_MAX_LENGTH),
  last4: Last4Schema,
  expMonth: ExpMonthSchema,
  expYear: ExpYearSchema,
  holderName: z.string(),
  status: CardStatusSchema,
  createdAt: z.iso.datetime(),
});
export type Card = z.infer<typeof CardSchema>;

export const CardListSchema = z.object({ items: z.array(CardSchema) });
export type CardList = z.infer<typeof CardListSchema>;

/** Emitir o renombrar (FR-001, FR-005). */
export const CardNicknameRequestSchema = z.strictObject({
  nickname: z.string().trim().min(1).max(CARD_NICKNAME_MAX_LENGTH),
});
export type CardNicknameRequest = z.infer<typeof CardNicknameRequestSchema>;

export const RevealCardRequestSchema = z.strictObject({
  password: z.string().min(1).max(128),
});
export type RevealCardRequest = z.infer<typeof RevealCardRequestSchema>;

/** Solo en `POST /cards/{cardId}/reveal` (FR-008). */
export const CardSecretsSchema = z.object({
  number: z.string().regex(/^9\d{15}$/),
  expMonth: ExpMonthSchema,
  expYear: ExpYearSchema,
  cvv: z.string().regex(/^\d{3}$/),
});
export type CardSecrets = z.infer<typeof CardSecretsSchema>;

export const CardPaymentSchema = z.object({
  id: z.uuid(),
  transactionId: z.uuid(),
  merchantId: MerchantIdSchema,
  merchantName: z.string(),
  category: MerchantCategorySchema,
  amount: MoneyAmountSchema,
  createdAt: z.iso.datetime(),
});
export type CardPayment = z.infer<typeof CardPaymentSchema>;

export const CardPaymentsPageSchema = z.object({
  items: z.array(CardPaymentSchema).max(MOVEMENTS_PAGE_SIZE),
  nextCursor: z.string().nullable(),
});
export type CardPaymentsPage = z.infer<typeof CardPaymentsPageSchema>;

/** Parámetros de `GET /cards/{cardId}/payments` (llegan como texto en la query string). */
export const CardPaymentsQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(MOVEMENTS_PAGE_SIZE).default(MOVEMENTS_PAGE_SIZE),
});
export type CardPaymentsQuery = z.infer<typeof CardPaymentsQuerySchema>;

export const PaymentLimitsSchema = z.object({
  minAmount: MoneyAmountSchema,
  maxAmount: MoneyAmountSchema,
  dailyLimit: MoneyAmountSchema,
  remainingToday: z.int().min(0),
});
export type PaymentLimits = z.infer<typeof PaymentLimitsSchema>;

/**
 * Pago en la tienda demo (FR-012). `cardNumber` se acepta con espacios y se devuelve sin ellos;
 * el dígito de control no se valida aquí: un número que no corresponde a una tarjeta propia se
 * rechaza con `CARD_DECLINED` (FR-014).
 */
export const CreateCardPaymentRequestSchema = z.strictObject({
  merchantId: MerchantIdSchema,
  amount: MoneyAmountSchema,
  cardNumber: z
    .string()
    .regex(/^[\d ]{16,19}$/)
    .transform(normalizeCardNumber)
    .pipe(z.string().regex(/^\d{16}$/)),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/),
  cvv: z.string().regex(/^\d{3}$/),
});
export type CreateCardPaymentRequest = z.input<typeof CreateCardPaymentRequestSchema>;

export const CardPaymentResultSchema = z.object({
  movement: MovementSchema,
  /** Saldo después del pago. */
  balance: z.int().min(0),
  cardLast4: Last4Schema,
});
export type CardPaymentResult = z.infer<typeof CardPaymentResultSchema>;
