import type { Prisma } from '@nova/db';
import {
  AliasSchema,
  normalizeEmail,
  partialName,
  type RecipientPreview,
  type TransferLimits,
  type TransferResult,
} from '@nova/shared';

import { startOfBogotaDay } from '../../lib/bogota-day.js';
import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import type { IdempotencyService } from '../../lib/idempotency/idempotency.service.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import { type AuthDirectory, type DirectoryEntry, maskEmail } from '../auth/auth.directory.js';
import type { ReauthService } from '../auth/reauth.service.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import type { ProfileService } from '../profile/profile.service.js';

const SCOPE = 'transfers.create';
const LOOKS_LIKE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface CreateTransferInput {
  userId: string;
  idempotencyKey: string;
  recipientId: string;
  amount: number;
  note?: string | null | undefined;
  password?: string | undefined;
  requestId: string;
}

export interface CreateTransferOutcome {
  status: number;
  body: TransferResult;
  replayed: boolean;
}

/** Nota sin espacios sobrantes; vacía equivale a no tener nota (FR-012). */
function cleanNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Transferencias entre estudiantes (spec 003, US1). No toca tablas: orquesta auth (directorio y
 * reautenticación), profile, accounts, ledger e idempotencia (research R1, R7).
 */
export function createTransfersService(
  ctx: ModuleContext,
  deps: {
    accounts: AccountsService;
    ledger: LedgerService;
    idempotency: IdempotencyService;
    directory: AuthDirectory;
    reauth: ReauthService;
    profile: ProfileService;
  },
) {
  const { config, prisma, clock, audit } = ctx;
  const { accounts, ledger, idempotency, directory, reauth, profile } = deps;

  async function remainingToday(db: Db, accountId: string): Promise<number> {
    // Solo lo enviado: la operación pertenece a la cuenta del emisor (data-model.md).
    const sent = await ledger.sumCompletedSince(
      db,
      accountId,
      'transfer',
      startOfBogotaDay(clock.now()),
    );
    return Math.max(0, config.transfers.dailyLimit - sent);
  }

  /** Busca por correo (si parece un correo) o por alias, con o sin @ (FR-001, research R3). */
  async function lookup(q: string): Promise<DirectoryEntry | null> {
    if (LOOKS_LIKE_EMAIL.test(q)) return directory.findByEmail(prisma, normalizeEmail(q));
    const alias = AliasSchema.safeParse(q);
    if (!alias.success) return null;
    const userId = await profile.findUserIdByAlias(prisma, alias.data);
    return userId ? directory.findById(prisma, userId) : null;
  }

  /** GET /transfers/recipient: vista previa con nombre parcial y correo enmascarado (FR-002). */
  async function findRecipient(userId: string, q: string): Promise<RecipientPreview> {
    const recipient = await lookup(q);
    if (!recipient) throw appError('RECIPIENT_NOT_FOUND');
    if (recipient.userId === userId) throw appError('TRANSFER_TO_SELF');
    // La cuenta se crea si el destinatario aún no tiene (como en la spec 002).
    const account = await accounts.ensureForUser(prisma, recipient.userId);
    return {
      recipientId: account.id,
      displayName: partialName(recipient.fullName),
      maskedEmail: maskEmail(recipient.email),
    };
  }

  /** GET /transfers/limits (FR-006, FR-008). */
  async function limits(userId: string): Promise<TransferLimits> {
    const account = await accounts.ensureForUser(prisma, userId);
    const { minAmount, maxAmount, dailyLimit, reauthThreshold } = config.transfers;
    return {
      minAmount,
      maxAmount,
      dailyLimit,
      reauthThreshold,
      remainingToday: await remainingToday(prisma, account.id),
    };
  }

  /** POST /transfers: flujo de research R7. */
  async function create(input: CreateTransferInput): Promise<CreateTransferOutcome> {
    const { minAmount, maxAmount, reauthThreshold } = config.transfers;
    const note = cleanNote(input.note);

    // El rango no depende de datos guardados: se valida antes de pedir la contraseña, para no
    // gastar un intento en un monto que se rechazaría igual.
    if (input.amount < minAmount || input.amount > maxAmount) {
      throw appError('TRANSFER_AMOUNT_OUT_OF_RANGE', { minAmount, maxAmount });
    }
    // Reautenticación FUERA de la transacción: los fallos se acumulan (research R4).
    if (input.amount > reauthThreshold) {
      if (!input.password) throw appError('REAUTH_REQUIRED', { reauthThreshold });
      await reauth.verify(input.userId, input.password, input.requestId);
    }

    return prisma.$transaction(
      async (tx) => {
        const own = await accounts.ensureForUser(tx, input.userId);
        if (input.recipientId === own.id) throw appError('TRANSFER_TO_SELF');
        const recipient = await accounts.findStudentAccountById(tx, input.recipientId);
        if (!recipient?.userId) throw appError('RECIPIENT_NOT_FOUND');

        // Dos cuentas en orden de id: transferencias cruzadas sin deadlock (research R6).
        const [sender] = await accounts.lockManyForUpdate(tx, [own.id, recipient.id]);
        if (!sender) throw new Error('falta la cuenta del emisor');

        // La contraseña no entra en el hash (research R4).
        const begun = await idempotency.begin(tx, {
          userId: input.userId,
          scope: SCOPE,
          key: input.idempotencyKey,
          body: { recipientId: input.recipientId, amount: input.amount, note },
        });
        if (begun.kind === 'replay') {
          return {
            status: begun.status,
            body: begun.body as unknown as TransferResult,
            replayed: true,
          };
        }

        const left = await remainingToday(tx, sender.id);
        if (input.amount > left) throw appError('TRANSFER_DAILY_LIMIT', { remainingToday: left });
        if (input.amount > sender.balance) {
          throw appError('INSUFFICIENT_FUNDS', { availableBalance: sender.balance });
        }

        const [from, to] = await Promise.all([
          directory.findById(tx, input.userId),
          directory.findById(tx, recipient.userId),
        ]);
        if (!from || !to) throw new Error('falta un usuario de la transferencia');
        const sentDescription = `Transferencia a ${partialName(to.fullName)}`;

        const movement = await ledger.post(tx, {
          type: 'transfer',
          accountId: sender.id,
          amount: input.amount,
          description: sentDescription,
          counterpartyAccountId: recipient.id,
          note,
          lines: [
            { accountId: sender.id, amount: -input.amount, description: sentDescription },
            {
              accountId: recipient.id,
              amount: input.amount,
              description: `Transferencia de ${partialName(from.fullName)}`,
            },
          ],
          requestId: input.requestId,
        });
        await audit.record(tx, 'TRANSFER_COMPLETED', {
          userId: input.userId,
          requestId: input.requestId,
          metadata: {
            amount: input.amount,
            transactionId: movement.transactionId,
            counterpartyAccountId: recipient.id,
          },
        });

        const body: TransferResult = { movement, balance: sender.balance - input.amount };
        await idempotency.complete(tx, begun.id, 201, body as unknown as Prisma.InputJsonValue);
        return { status: 201, body, replayed: false };
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }

  return { findRecipient, limits, create };
}

export type TransfersService = ReturnType<typeof createTransfersService>;
