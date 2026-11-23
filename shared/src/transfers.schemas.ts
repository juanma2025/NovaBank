/**
 * Esquemas de la API de perfil (alias) y transferencias (spec 003). Cada esquema corresponde a un
 * `components.schemas` de specs/003-transferencias/contracts/transfers.openapi.json.
 */
import { z } from 'zod';

import { MovementSchema } from './accounts.schemas.js';
import { EMAIL_MAX_LENGTH } from './constants.js';
import { MoneyAmountSchema } from './money.js';

export const ALIAS_MIN_LENGTH = 3;
export const ALIAS_MAX_LENGTH = 20;
export const TRANSFER_NOTE_MAX_LENGTH = 140;
export const RECIPIENT_QUERY_MIN_LENGTH = 3;

/** Formato guardado (data-model.md, `Profile.alias`): igual al `CHECK` de la base de datos. */
export const ALIAS_PATTERN = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/;

/**
 * Alias (FR-015): se acepta con o sin `@` y en mayúsculas, y se devuelve normalizado
 * («@Ana.Perez» → «ana.perez»).
 */
export const AliasSchema = z
  .string()
  .trim()
  .max(ALIAS_MAX_LENGTH + 1)
  .transform((value) => value.replace(/^@/, '').toLowerCase())
  .pipe(
    z
      .string()
      .min(ALIAS_MIN_LENGTH)
      .max(ALIAS_MAX_LENGTH)
      .regex(
        ALIAS_PATTERN,
        'Usa de 3 a 20 letras sin tilde, números, «.» o «_», y empieza y termina con letra o número',
      ),
  );
export type Alias = z.output<typeof AliasSchema>;

export const ProfileSchema = z.object({
  fullName: z.string(),
  email: z.email(),
  /** Normalizado, sin `@`; null si no tiene. */
  alias: z.string().nullable(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const SetAliasRequestSchema = z.strictObject({
  alias: AliasSchema,
});
export type SetAliasRequest = z.input<typeof SetAliasRequestSchema>;

/** Parámetros de `GET /transfers/recipient`: correo institucional o alias (con o sin `@`). */
export const RecipientQuerySchema = z.strictObject({
  q: z.string().trim().min(RECIPIENT_QUERY_MIN_LENGTH).max(EMAIL_MAX_LENGTH),
});
export type RecipientQuery = z.infer<typeof RecipientQuerySchema>;

export const RecipientPreviewSchema = z.object({
  /** Cuenta del destinatario; se envía en `POST /transfers` (research R3). */
  recipientId: z.uuid(),
  /** Nombre parcial, ej. «Ana P. G.». */
  displayName: z.string(),
  /** Correo enmascarado, ej. «an***@ucc.edu.co». */
  maskedEmail: z.string(),
});
export type RecipientPreview = z.infer<typeof RecipientPreviewSchema>;

export const TransferLimitsSchema = z.object({
  minAmount: MoneyAmountSchema,
  maxAmount: MoneyAmountSchema,
  dailyLimit: MoneyAmountSchema,
  /** Por encima de este monto se exige la contraseña. */
  reauthThreshold: MoneyAmountSchema,
  remainingToday: z.int().min(0),
});
export type TransferLimits = z.infer<typeof TransferLimitsSchema>;

export const CreateTransferRequestSchema = z.strictObject({
  recipientId: z.uuid(),
  amount: MoneyAmountSchema,
  note: z.string().max(TRANSFER_NOTE_MAX_LENGTH).nullable().optional(),
  /** Obligatoria si `amount` supera `reauthThreshold`. Nunca entra en el hash de idempotencia. */
  password: z.string().min(1).max(128).optional(),
});
export type CreateTransferRequest = z.infer<typeof CreateTransferRequestSchema>;

export const TransferResultSchema = z.object({
  movement: MovementSchema,
  /** Saldo del emisor después de la transferencia. */
  balance: z.int().min(0),
});
export type TransferResult = z.infer<typeof TransferResultSchema>;
