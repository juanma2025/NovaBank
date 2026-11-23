import {
  formatCOP,
  type CreateSplitRequest,
  type PayShareResult,
  type Split,
  type SplitListItem,
  type SplitsPage,
  type SplitsSummary,
} from '@nova/shared';

import { decodeCursor, encodeCursor } from '../../lib/cursor.js';
import { appError } from '../../lib/errors.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import type { AuthDirectory } from '../auth/auth.directory.js';
import type { TransfersService } from '../transfers/transfers.service.js';
import { createSplitsActions } from './splits-actions.service.js';
import { splitsRepository as repo } from './splits.repository.js';
import { createSplitsSupport, notPending } from './splits.support.js';

export interface PayShareInput {
  userId: string;
  splitId: string;
  password?: string | undefined;
  idempotencyKey: string;
  requestId: string;
}

/**
 * Gastos compartidos (spec 007). Crear, rechazar, marcar, recordar y cancelar no mueven dinero; pagar
 * una parte es una transferencia normal de la spec 003, con la parte marcada en su misma transacción
 * (regla de dominio 11, research R1 y R2). Las acciones sin dinero viven en
 * `splits-actions.service.ts`.
 */
export function createSplitsService(
  ctx: ModuleContext,
  deps: { accounts: AccountsService; transfers: TransfersService; directory: AuthDirectory },
) {
  const { config, prisma, clock } = ctx;
  const { accounts, transfers } = deps;
  const support = createSplitsSupport(ctx, deps);
  const actions = createSplitsActions(ctx, support);
  const { people, nameOf, email } = support;

  /** FR-001–FR-004, FR-015: crea la división sin mover dinero y avisa a los participantes. */
  async function create(userId: string, input: CreateSplitRequest): Promise<Split> {
    const ids = input.shares.map((s) => s.recipientId);
    if (new Set(ids).size !== ids.length) {
      throw appError('VALIDATION_ERROR', { fields: { shares: 'duplicate' } });
    }
    const sum = input.shares.reduce((total, s) => total + s.amount, input.creatorShare);
    if (sum !== input.totalAmount) throw appError('SPLIT_SHARES_MISMATCH');
    const { minAmount, maxAmount } = config.transfers;
    if (input.shares.some((s) => s.amount < minAmount || s.amount > maxAmount)) {
      throw appError('SPLIT_SHARE_OUT_OF_RANGE', { minAmount, maxAmount });
    }

    // recipientId es la cuenta de la vista previa de la spec 003 (research R3).
    const participants = await Promise.all(
      input.shares.map(async (s) => {
        const account = await accounts.findStudentAccountById(prisma, s.recipientId);
        if (!account?.userId) throw appError('RECIPIENT_NOT_FOUND');
        return { userId: account.userId, amount: s.amount };
      }),
    );
    if (participants.some((p) => p.userId === userId)) {
      throw appError('VALIDATION_ERROR', { fields: { shares: 'includes_creator' } });
    }

    return prisma.$transaction(async (tx) => {
      const row = await repo.create(tx, {
        creatorUserId: userId,
        title: input.title,
        totalAmount: input.totalAmount,
        creatorShare: input.creatorShare,
        shares: participants,
        now: clock.now(),
      });
      const map = await people(tx, [userId, ...participants.map((p) => p.userId)]);
      for (const share of row.shares) {
        await email(tx, 'split_invitation', map.get(share.userId), {
          creatorName: nameOf(map, userId),
          title: row.title,
          amount: formatCOP(toSafeNumber(share.amount)),
        });
      }
      return support.toSplit(tx, row, userId);
    });
  }

  /**
   * «Pagar mi parte» (FR-005, FR-006): una transferencia normal a quien creó la división. La parte se
   * bloquea y se marca dentro de la transacción de la transferencia; si ya no está pendiente, se
   * revierte todo (research R2).
   */
  async function payMyShare(
    input: PayShareInput,
  ): Promise<{ status: number; body: PayShareResult }> {
    const row = await support.visibleOrThrow(prisma, input.userId, input.splitId);
    const mine = row.shares.find((s) => s.userId === input.userId);
    if (!mine) throw appError('NOT_FOUND');
    const creatorAccount = await accounts.ensureForUser(prisma, row.creatorUserId);

    const outcome = await transfers.create(
      {
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        recipientId: creatorAccount.id,
        amount: toSafeNumber(mine.amount),
        note: `Gasto compartido: ${row.title}`,
        password: input.password,
        requestId: input.requestId,
      },
      {
        inTransaction: async (tx, result) => {
          await repo.lockSplit(tx, row.id);
          const share = await repo.lockShare(tx, row.id, mine.id);
          if (!share) throw appError('NOT_FOUND');
          if (share.status !== 'pending') throw notPending(share);
          await repo.resolveShare(tx, share.id, 'paid', clock.now(), result.movement.transactionId);
          await support.completeIfResolved(tx, row.id);
          const map = await people(tx, [row.creatorUserId, input.userId]);
          await email(tx, 'split_paid', map.get(row.creatorUserId), {
            participantName: nameOf(map, input.userId),
            title: row.title,
            amount: formatCOP(toSafeNumber(share.amount)),
          });
        },
      },
    );
    return {
      status: outcome.status,
      body: { split: await support.get(input.userId, row.id), ...outcome.body },
    };
  }

  /** FR-012: lista paginada de las divisiones que creó o en las que participa. */
  async function list(
    userId: string,
    { cursor, limit }: { cursor?: string | undefined; limit: number },
  ): Promise<SplitsPage> {
    const after = cursor ? decodeCursor(cursor) : undefined;
    const rows = await repo.list(prisma, userId, limit + 1, after);
    const page = rows.slice(0, limit);
    const map = await people(
      prisma,
      page.map((r) => r.creatorUserId),
    );
    const items: SplitListItem[] = page.map((row) => {
      const pending = row.shares.filter((s) => s.status === 'pending');
      const mine = row.shares.find((s) => s.userId === userId);
      return {
        id: row.id,
        title: row.title,
        totalAmount: toSafeNumber(row.totalAmount),
        creatorName: nameOf(map, row.creatorUserId),
        role: row.creatorUserId === userId ? 'creator' : 'participant',
        status: row.status,
        pendingCount: pending.length,
        pendingAmount: pending.reduce((sum, s) => sum + toSafeNumber(s.amount), 0),
        myShare: mine ? { amount: toSafeNumber(mine.amount), status: mine.status } : null,
        createdAt: row.createdAt.toISOString(),
      };
    });
    const last = page.at(-1);
    return { items, nextCursor: rows.length > limit && last ? encodeCursor(last) : null };
  }

  async function summary(userId: string): Promise<SplitsSummary> {
    const totals = await repo.pendingTotals(prisma, userId);
    return {
      toCollect: { count: totals.toCollect.count, amount: toSafeNumber(totals.toCollect.amount) },
      toPay: { count: totals.toPay.count, amount: toSafeNumber(totals.toPay.amount) },
    };
  }

  return { create, get: support.get, payMyShare, list, summary, ...actions };
}

export type SplitsService = ReturnType<typeof createSplitsService>;
