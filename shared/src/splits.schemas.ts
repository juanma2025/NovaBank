/**
 * Esquemas de la API de gastos compartidos (spec 007). Cada esquema corresponde a un
 * `components.schemas` de specs/007-gastos-compartidos/contracts/splits.openapi.json.
 */
import { z } from 'zod';

import { MovementSchema } from './accounts.schemas.js';
import { MOVEMENTS_PAGE_SIZE } from './constants.js';
import { MoneyAmountSchema } from './money.js';
import {
  SPLIT_MAX_PARTICIPANTS,
  SPLIT_TITLE_MAX_LENGTH,
  SPLIT_TOTAL_MAX,
  SPLIT_TOTAL_MIN,
} from './splits.js';

const TotalAmountSchema = z.int().min(SPLIT_TOTAL_MIN).max(SPLIT_TOTAL_MAX);

export const SplitStatusSchema = z.enum(['open', 'completed', 'canceled']);
export type SplitStatus = z.infer<typeof SplitStatusSchema>;

export const SplitShareStatusSchema = z.enum([
  'pending',
  'paid',
  'paid_outside',
  'declined',
  'canceled',
]);
export type SplitShareStatus = z.infer<typeof SplitShareStatusSchema>;

export const SplitRoleSchema = z.enum(['creator', 'participant']);
export type SplitRole = z.infer<typeof SplitRoleSchema>;

export const SplitShareSchema = z.object({
  id: z.uuid(),
  /** Nombre parcial (spec 003); nunca el correo completo (FR-013). */
  displayName: z.string(),
  amount: MoneyAmountSchema,
  status: SplitShareStatusSchema,
  resolvedAt: z.iso.datetime().nullable(),
  lastRemindedAt: z.iso.datetime().nullable(),
  /** Es la parte de quien consulta. */
  isMe: z.boolean(),
});
export type SplitShare = z.infer<typeof SplitShareSchema>;

export const SplitSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(SPLIT_TITLE_MAX_LENGTH),
  totalAmount: TotalAmountSchema,
  creatorShare: z.int().min(0),
  creatorName: z.string(),
  role: SplitRoleSchema,
  status: SplitStatusSchema,
  shares: z.array(SplitShareSchema).min(1).max(SPLIT_MAX_PARTICIPANTS),
  createdAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});
export type Split = z.infer<typeof SplitSchema>;

export const SplitListItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  totalAmount: z.int().min(SPLIT_TOTAL_MIN),
  creatorName: z.string(),
  role: SplitRoleSchema,
  status: SplitStatusSchema,
  pendingCount: z.int().min(0),
  pendingAmount: z.int().min(0),
  /** Mi parte si participo; null si la creé. */
  myShare: z.object({ amount: MoneyAmountSchema, status: SplitShareStatusSchema }).nullable(),
  createdAt: z.iso.datetime(),
});
export type SplitListItem = z.infer<typeof SplitListItemSchema>;

export const SplitsPageSchema = z.object({
  items: z.array(SplitListItemSchema).max(MOVEMENTS_PAGE_SIZE),
  nextCursor: z.string().nullable(),
});
export type SplitsPage = z.infer<typeof SplitsPageSchema>;

/** Parámetros de `GET /splits` (llegan como texto en la query string). */
export const SplitsQuerySchema = z.strictObject({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(MOVEMENTS_PAGE_SIZE).default(MOVEMENTS_PAGE_SIZE),
});
export type SplitsQuery = z.infer<typeof SplitsQuerySchema>;

export const PendingTotalsSchema = z.object({ count: z.int().min(0), amount: z.int().min(0) });

export const SplitsSummarySchema = z.object({
  /** Partes pendientes de mis divisiones abiertas. */
  toCollect: PendingTotalsSchema,
  /** Mis partes pendientes en divisiones abiertas. */
  toPay: PendingTotalsSchema,
});
export type SplitsSummary = z.infer<typeof SplitsSummarySchema>;

export const CreateSplitRequestSchema = z.strictObject({
  title: z.string().trim().min(1).max(SPLIT_TITLE_MAX_LENGTH),
  totalAmount: TotalAmountSchema,
  creatorShare: z.int().min(0),
  shares: z
    .array(
      z.strictObject({
        /** De `GET /transfers/recipient` (spec 003). */
        recipientId: z.uuid(),
        amount: MoneyAmountSchema,
      }),
    )
    .min(1)
    .max(SPLIT_MAX_PARTICIPANTS),
});
export type CreateSplitRequest = z.infer<typeof CreateSplitRequestSchema>;

export const PayShareRequestSchema = z.strictObject({
  /** Obligatoria si el monto supera el umbral de las transferencias (spec 003). */
  password: z.string().min(1).max(128).optional(),
});
export type PayShareRequest = z.infer<typeof PayShareRequestSchema>;

export const PayShareResultSchema = z.object({
  split: SplitSchema,
  /** La transferencia vista desde quien paga. */
  movement: MovementSchema,
  balance: z.int().min(0),
});
export type PayShareResult = z.infer<typeof PayShareResultSchema>;
