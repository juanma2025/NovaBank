/**
 * Esquemas de la API de cuentas, libro contable y recargas (spec 002). Cada esquema corresponde a
 * un `components.schemas` de specs/002-cuentas-ledger/contracts/accounts.openapi.json.
 */
import { z } from 'zod';

import { MOVEMENTS_PAGE_SIZE, RECENT_MOVEMENTS } from './constants.js';
import { MoneyAmountSchema, SignedMoneySchema } from './money.js';

export const MovementTypeSchema = z.enum(['topup', 'transfer']);
export type MovementType = z.infer<typeof MovementTypeSchema>;

/** Estados de una operación (constitución, regla de dominio 7). */
export const LedgerTransactionStatusSchema = z.enum(['pending', 'completed', 'failed', 'reversed']);
export type LedgerTransactionStatus = z.infer<typeof LedgerTransactionStatusSchema>;

/** Un movimiento visto desde la cuenta del estudiante (contrato `Movement`). */
export const MovementSchema = z.object({
  id: z.uuid(),
  transactionId: z.uuid(),
  type: MovementTypeSchema,
  description: z.string().max(140),
  /** Nota de la transferencia; null si no hay (cambio aprobado en la spec 003). */
  note: z.string().max(140).nullable(),
  /** Con signo: + entra, − sale. */
  amount: SignedMoneySchema,
  status: LedgerTransactionStatusSchema,
  createdAt: z.iso.datetime(),
});
export type Movement = z.infer<typeof MovementSchema>;

export const AccountSummarySchema = z.object({
  id: z.uuid(),
  currency: z.literal('COP'),
  balance: z.int().min(0),
  recentMovements: z.array(MovementSchema).max(RECENT_MOVEMENTS),
});
export type AccountSummary = z.infer<typeof AccountSummarySchema>;

export const MovementsPageSchema = z.object({
  items: z.array(MovementSchema).max(MOVEMENTS_PAGE_SIZE),
  /** null si no hay más páginas. */
  nextCursor: z.string().nullable(),
});
export type MovementsPage = z.infer<typeof MovementsPageSchema>;

/** Parámetros de `GET /accounts/me/movements` (llegan como texto en la query string). */
export const MovementsQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(MOVEMENTS_PAGE_SIZE).default(MOVEMENTS_PAGE_SIZE),
});
export type MovementsQuery = z.infer<typeof MovementsQuerySchema>;

export const TopupLimitsSchema = z.object({
  minAmount: MoneyAmountSchema,
  maxAmount: MoneyAmountSchema,
  dailyLimit: MoneyAmountSchema,
  remainingToday: z.int().min(0),
});
export type TopupLimits = z.infer<typeof TopupLimitsSchema>;

export const CreateTopupRequestSchema = z.strictObject({
  amount: MoneyAmountSchema,
});
export type CreateTopupRequest = z.infer<typeof CreateTopupRequestSchema>;

export const TopupResultSchema = z.object({
  movement: MovementSchema,
  /** Saldo después de la recarga. */
  balance: z.int().min(0),
});
export type TopupResult = z.infer<typeof TopupResultSchema>;
