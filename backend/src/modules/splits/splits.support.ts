import type { EmailTemplate, SplitShare } from '@nova/db';
import { partialName, type Split } from '@nova/shared';

import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import { outboxRepository } from '../../lib/mail/outbox.repository.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AuthDirectory, DirectoryEntry } from '../auth/auth.directory.js';
import { splitsRepository as repo, type SplitWithShares } from './splits.repository.js';

/** Error de una parte que ya no está pendiente: cancelada → división cerrada (research R5). */
export function notPending(share: SplitShare) {
  return appError(share.status === 'canceled' ? 'SPLIT_CLOSED' : 'SHARE_NOT_PENDING');
}

/**
 * Piezas compartidas del módulo splits (spec 007): nombres parciales, vista de la división, correos,
 * visibilidad y bloqueos (FR-013, FR-014, research R5 y R6).
 */
export function createSplitsSupport(
  ctx: Pick<ModuleContext, 'prisma' | 'clock'>,
  deps: { directory: AuthDirectory },
) {
  const { prisma, clock } = ctx;

  /** Nombre parcial y correo de cada usuario (los correos nunca salen en la API, FR-013). */
  async function people(db: Db, userIds: string[]): Promise<Map<string, DirectoryEntry>> {
    const unique = [...new Set(userIds)];
    const entries = await Promise.all(unique.map((id) => deps.directory.findById(db, id)));
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

  async function get(userId: string, splitId: string): Promise<Split> {
    return toSplit(prisma, await visibleOrThrow(prisma, userId, splitId), userId);
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

  return {
    people,
    nameOf,
    toSplit,
    email,
    visibleOrThrow,
    get,
    lockAsCreator,
    completeIfResolved,
  };
}

export type SplitsSupport = ReturnType<typeof createSplitsSupport>;
