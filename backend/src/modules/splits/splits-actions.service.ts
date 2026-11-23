import { formatCOP, SPLIT_REMINDER_INTERVAL_HOURS, type Split } from '@nova/shared';

import { addSeconds, secondsUntil } from '../../lib/clock.js';
import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import { splitsRepository as repo } from './splits.repository.js';
import { notPending, type SplitsSupport } from './splits.support.js';

const REMINDER_SECONDS = SPLIT_REMINDER_INTERVAL_HOURS * 60 * 60;

/**
 * Acciones que no mueven dinero (spec 007, FR-007, FR-008, FR-010 y FR-011): rechazar mi parte,
 * marcar pagada por fuera, recordar y cancelar. Todas con las filas bloqueadas (research R5, R7).
 */
export function createSplitsActions(
  ctx: Pick<ModuleContext, 'prisma' | 'clock'>,
  support: SplitsSupport,
) {
  const { prisma, clock } = ctx;

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
      await support.completeIfResolved(tx, row.id);
    });
    return support.get(userId, splitId);
  }

  /** Bloquea la división (como creadora) y una de sus partes pendientes. */
  async function lockPendingShareAsCreator(
    tx: Db,
    userId: string,
    splitId: string,
    shareId: string,
  ) {
    const row = await support.lockAsCreator(tx, userId, splitId);
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
      await support.completeIfResolved(tx, row.id);
    });
    return support.get(userId, splitId);
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
      const map = await support.people(tx, [userId, share.userId]);
      await support.email(tx, 'split_reminder', map.get(share.userId), {
        creatorName: support.nameOf(map, userId),
        title: row.title,
        amount: formatCOP(toSafeNumber(share.amount)),
      });
    });
    return support.get(userId, splitId);
  }

  /** FR-010: cancela; las partes pendientes quedan canceladas y las pagadas no se devuelven. */
  async function cancel(userId: string, splitId: string): Promise<Split> {
    await prisma.$transaction(async (tx) => {
      const row = await support.lockAsCreator(tx, userId, splitId);
      if (row.status !== 'open') throw appError('SPLIT_CLOSED');
      const now = clock.now();
      await repo.cancelPendingShares(tx, row.id, now);
      await repo.close(tx, row.id, 'canceled', now);
    });
    return support.get(userId, splitId);
  }

  return { declineMyShare, markPaid, remind, cancel };
}
