import type { EmailTemplate, SplitShare } from '@nova/db';
import {
  formatCOP,
  partialName,
  SPLIT_REMINDER_INTERVAL_HOURS,
  type CreateSplitRequest,
  type PayShareResult,
  type Split,
  type SplitListItem,
  type SplitsPage,
  type SplitsSummary,
} from '@nova/shared';

import { addSeconds, secondsUntil } from '../../lib/clock.js';
import { decodeCursor, encodeCursor } from '../../lib/cursor.js';
import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import { outboxRepository } from '../../lib/mail/outbox.repository.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import type { AuthDirectory, DirectoryEntry } from '../auth/auth.directory.js';
import type { TransfersService } from '../transfers/transfers.service.js';
import { splitsRepository as repo, type SplitWithShares } from './splits.repository.js';

const REMINDER_SECONDS = SPLIT_REMINDER_INTERVAL_HOURS * 60 * 60;

export interface PayShareInput {
  userId: string;
  splitId: string;
  password?: string | undefined;
  idempotencyKey: string;
  requestId: string;
}

/** Error de una parte que ya no está pendiente: cancelada → división cerrada (research R5). */
function notPending(share: SplitShare) {
  return appError(share.status === 'canceled' ? 'SPLIT_CLOSED' : 'SHARE_NOT_PENDING');
}

/**
 * Gastos compartidos (spec 007). Crear, rechazar, marcar, recordar y cancelar no mueven dinero; pagar
 * una parte es una transferencia normal de la spec 003, con la parte marcada en su misma transacción
 * (regla de dominio 11, research R1 y R2).
 */
export function createSplitsService(
  ctx: ModuleContext,
  deps: { accounts: AccountsService; transfers: TransfersService; directory: AuthDirectory },
) {
  const { config, prisma, clock } = ctx;
  const { accounts, transfers, directory } = deps;

  /** Nombre parcial y correo de cada usuario (los correos nunca salen en la API, FR-013). */
  async function people(db: Db, userIds: string[]): Promise<Map<string, DirectoryEntry>> {
    const unique = [...new Set(userIds)];
    const entries = await Promise.all(unique.map((id) => directory.findById(db, id)));
    return new Map(entries.flatMap((e) => (e ? [[e.userId, e] as const] : [])));
  }

  const nameOf = (map: Map<string, DirectoryEntry>, userId: string): string =>
    partialName(map.get(userId)?.fullName ?? '');

  async function toSplit(db: Db, row: SplitWithShares, viewerId: string): Promise<Split> {
    const map = await people(db, [row.creatorUserId, ...row.shares.map((s) => s.userId)]);
    return {
      id: row.id,
      title: row.title,
      totalAmount: toSafeNumber(row.totalAmount),
      creatorShare: toSafeNumber(row.creatorShare),
      creatorName: nameOf(map, row.creatorUserId),
      role: row.creatorUserId === viewerId ? 'creator' : 'participant',
      status: row.status,
      shares: row.shares.map((s) => ({
        id: s.id,
        displayName: nameOf(map, s.userId),
        amount: toSafeNumber(s.amount),
        status: s.status,
        resolvedAt: s.resolvedAt?.toISOString() ?? null,
        lastRemindedAt: s.lastRemindedAt?.toISOString() ?? null,
        isMe: s.userId === viewerId,
      })),
      createdAt: row.createdAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
    };
  }

  async function email(
    db: Db,
    template: EmailTemplate,
    to: DirectoryEntry | undefined,
    payload: Record<string, string>,
  ): Promise<void> {
    if (!to) return;
    await outboxRepository.enqueue(db, { template, to: to.email, payload, now: clock.now() });
  }

  /** División visible para la estudiante, o 404 (FR-014). */
  async function visibleOrThrow(db: Db, userId: string, splitId: string) {
    const row = await repo.findVisible(db, userId, splitId);
    if (!row) throw appError('NOT_FOUND');
    return row;
  }

  /** Bloquea la división de la que la estudiante es creadora; un participante o un tercero → 404. */
  async function lockAsCreator(tx: Db, userId: string, splitId: string) {
    const row = await repo.lockSplit(tx, splitId);
    if (!row || row.creatorUserId !== userId) throw appError('NOT_FOUND');
    return row;
  }

  /** Cierra la división como completada si ya no quedan partes pendientes (FR-009). */
  async function completeIfResolved(tx: Db, splitId: string): Promise<void> {
    if ((await repo.countPending(tx, splitId)) === 0) {
      await repo.close(tx, splitId, 'completed', clock.now());
    }
  }

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
      return toSplit(tx, row, userId);
    });
  }

  async function get(userId: string, splitId: string): Promise<Split> {
    return toSplit(prisma, await visibleOrThrow(prisma, userId, splitId), userId);
  }

  /**
   * «Pagar mi parte» (FR-005, FR-006): una transferencia normal a quien creó la división. La parte se
   * bloquea y se marca dentro de la transacción de la transferencia; si ya no está pendiente, se
   * revierte todo (research R2).
   */
  async function payMyShare(
    input: PayShareInput,
  ): Promise<{ status: number; body: PayShareResult }> {
    const row = await visibleOrThrow(prisma, input.userId, input.splitId);
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
          await completeIfResolved(tx, row.id);
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
      body: { split: await get(input.userId, row.id), ...outcome.body },
    };
  }

  /** FR-008: el participante rechaza su parte pendiente. */
  async function declineMyShare(userId: string, splitId: string): Promise<Split> {
    await prisma.$transaction(async (tx) => {
      const row = await repo.lockSplit(tx, splitId);
      const mine = row?.shares.find((s) => s.userId === userId);
      if (!row || !mine) throw appError('NOT_FOUND');
      const share = await repo.lockShare(tx, row.id, mine.id);
      if (!share) throw appError('NOT_FOUND');
      if (share.status !== 'pending') throw notPending(share);
      await repo.resolveShare(tx, share.id, 'declined', clock.now());
      await completeIfResolved(tx, row.id);
    });
    return get(userId, splitId);
  }

  /** Bloquea división (como creadora) y una de sus partes pendientes. */
  async function lockPendingShareAsCreator(
    tx: Db,
    userId: string,
    splitId: string,
    shareId: string,
  ) {
    const row = await lockAsCreator(tx, userId, splitId);
    const share = await repo.lockShare(tx, row.id, shareId);
    if (!share) throw appError('NOT_FOUND');
    if (share.status !== 'pending') throw notPending(share);
    return { row, share };
  }

  /** FR-007: quien creó la división marca una parte como pagada por fuera; no mueve dinero. */
  async function markPaid(userId: string, splitId: string, shareId: string): Promise<Split> {
    await prisma.$transaction(async (tx) => {
      const { row, share } = await lockPendingShareAsCreator(tx, userId, splitId, shareId);
      await repo.resolveShare(tx, share.id, 'paid_outside', clock.now());
      await completeIfResolved(tx, row.id);
    });
    return get(userId, splitId);
  }

  /** FR-011: recordatorio por correo, como máximo uno cada 24 h por parte (research R7). */
  async function remind(userId: string, splitId: string, shareId: string): Promise<Split> {
    await prisma.$transaction(async (tx) => {
      const { row, share } = await lockPendingShareAsCreator(tx, userId, splitId, shareId);
      const now = clock.now();
      if (share.lastRemindedAt) {
        const next = addSeconds(share.lastRemindedAt, REMINDER_SECONDS);
        if (next > now) {
          throw appError('SPLIT_REMINDER_TOO_SOON', {
            retryAfterSeconds: secondsUntil(now, next),
          });
        }
      }
      await repo.setReminded(tx, share.id, now);
      const map = await people(tx, [userId, share.userId]);
      await email(tx, 'split_reminder', map.get(share.userId), {
        creatorName: nameOf(map, userId),
        title: row.title,
        amount: formatCOP(toSafeNumber(share.amount)),
      });
    });
    return get(userId, splitId);
  }

  /** FR-010: cancela; las partes pendientes quedan canceladas y las pagadas no se devuelven. */
  async function cancel(userId: string, splitId: string): Promise<Split> {
    await prisma.$transaction(async (tx) => {
      const row = await lockAsCreator(tx, userId, splitId);
      if (row.status !== 'open') throw appError('SPLIT_CLOSED');
      const now = clock.now();
      await repo.cancelPendingShares(tx, row.id, now);
      await repo.close(tx, row.id, 'canceled', now);
    });
    return get(userId, splitId);
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

  return { create, get, payMyShare, declineMyShare, markPaid, remind, cancel, list, summary };
}

export type SplitsService = ReturnType<typeof createSplitsService>;
