import type { Card as CardRow, CardStatus } from '@nova/db';
import { MAX_ACTIVE_CARDS, type Card, type CardSecrets } from '@nova/shared';

import type { AuditService } from '../../lib/audit/audit.service.js';
import { type CardCrypto, generatePan } from '../../lib/card-crypto.js';
import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import type { AuthDirectory } from '../auth/auth.directory.js';
import type { ReauthService } from '../auth/reauth.service.js';
import { cardsRepository as repo } from './cards.repository.js';

const CARD_LIFETIME_YEARS = 4;

const bogotaMonth = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
});

/** Mes y año de vencimiento: los de emisión en Bogotá + 4 años (FR-003). */
function expiryFrom(now: Date): { expMonth: number; expYear: number } {
  const [year = '', month = ''] = bogotaMonth.format(now).split('-');
  return { expMonth: Number(month), expYear: Number(year) + CARD_LIFETIME_YEARS };
}

/** Vista estándar: nunca el número completo ni el CVV (regla de dominio 8). */
export function toCard(row: CardRow, holderName: string): Card {
  return {
    id: row.id,
    nickname: row.nickname,
    last4: row.last4,
    expMonth: row.expMonth,
    expYear: row.expYear,
    holderName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

type StatusAction = 'freeze' | 'unfreeze' | 'cancel';
const TARGET: Record<StatusAction, CardStatus> = {
  freeze: 'frozen',
  unfreeze: 'active',
  cancel: 'canceled',
};
const AUDIT = {
  freeze: 'CARD_FROZEN',
  unfreeze: 'CARD_UNFROZEN',
  cancel: 'CARD_CANCELED',
} as const;

/**
 * Tarjetas del estudiante (spec 004, US1, US2 y US4). Usa accounts (bloqueo de la cuenta al
 * emitir), auth (titular y reautenticación) y su propio repositorio (research R1).
 */
export function createCardsService(
  ctx: ModuleContext,
  deps: {
    accounts: AccountsService;
    directory: AuthDirectory;
    reauth: ReauthService;
    crypto: CardCrypto;
  },
) {
  const { prisma, clock } = ctx;
  const audit: AuditService = ctx.audit;
  const { accounts, directory, reauth, crypto } = deps;

  async function holderNameOf(db: Db, userId: string): Promise<string> {
    const user = await directory.findById(db, userId);
    if (!user) throw appError('UNAUTHENTICATED');
    return user.fullName.toLocaleUpperCase('es-CO');
  }

  const cardEvent = (row: CardRow) => ({ cardId: row.id, last4: row.last4 });

  async function list(userId: string): Promise<Card[]> {
    const [rows, holder] = await Promise.all([
      repo.listByUser(prisma, userId),
      holderNameOf(prisma, userId),
    ]);
    // Vigentes primero (en orden de emisión) y canceladas al final.
    const ordered = [
      ...rows.filter((r) => r.status !== 'canceled'),
      ...rows.filter((r) => r.status === 'canceled'),
    ];
    return ordered.map((row) => toCard(row, holder));
  }

  /** Emite una tarjeta activa (FR-001–FR-003). Máximo 3 vigentes (research R7). */
  async function issue(userId: string, nickname: string, requestId: string): Promise<Card> {
    return prisma.$transaction(async (tx) => {
      // Bloquear la cuenta serializa emisiones simultáneas del mismo estudiante.
      const own = await accounts.ensureForUser(tx, userId);
      await accounts.lockForUpdate(tx, own.id);
      if ((await repo.countActive(tx, userId)) >= MAX_ACTIVE_CARDS) {
        throw appError('CARD_LIMIT_REACHED');
      }

      let pan = generatePan();
      while (await repo.existsByPanHash(tx, crypto.panHash(pan))) pan = generatePan();
      const now = clock.now();
      const row = await repo.create(tx, {
        userId,
        nickname,
        last4: pan.slice(-4),
        panEncrypted: crypto.encryptPan(pan),
        panHash: crypto.panHash(pan),
        ...expiryFrom(now),
        now,
      });
      await audit.record(tx, 'CARD_ISSUED', { userId, requestId, metadata: cardEvent(row) });
      return toCard(row, await holderNameOf(tx, userId));
    });
  }

  /** Tarjeta propia con la fila bloqueada; otra persona o inexistente → 404 (FR-010). */
  async function lockOwnedOrThrow(tx: Db, userId: string, cardId: string): Promise<CardRow> {
    const row = await repo.lockOwned(tx, userId, cardId);
    if (!row) throw appError('NOT_FOUND');
    if (row.status === 'canceled') throw appError('CARD_CANCELED');
    return row;
  }

  /**
   * Congelar, descongelar o cancelar (research R8). Repetir una acción ya aplicada responde la
   * tarjeta sin cambios ni otra auditoría.
   */
  async function changeStatus(
    userId: string,
    cardId: string,
    action: StatusAction,
    requestId: string,
  ): Promise<Card> {
    return prisma.$transaction(async (tx) => {
      let row = await lockOwnedOrThrow(tx, userId, cardId);
      if (row.status !== TARGET[action]) {
        row = await repo.updateStatus(tx, row.id, TARGET[action], clock.now());
        await audit.record(tx, AUDIT[action], { userId, requestId, metadata: cardEvent(row) });
      }
      return toCard(row, await holderNameOf(tx, userId));
    });
  }

  async function rename(userId: string, cardId: string, nickname: string): Promise<Card> {
    return prisma.$transaction(async (tx) => {
      const row = await lockOwnedOrThrow(tx, userId, cardId);
      const updated = await repo.updateNickname(tx, row.id, nickname, clock.now());
      return toCard(updated, await holderNameOf(tx, userId));
    });
  }

  /**
   * Datos completos con la contraseña (FR-008, research R4). La reautenticación va fuera de toda
   * transacción para que los fallos se acumulen; la tarjeta se valida antes para no gastar un
   * intento en una tarjeta inexistente.
   */
  async function reveal(
    userId: string,
    cardId: string,
    password: string,
    requestId: string,
  ): Promise<CardSecrets> {
    const row = await repo.findOwned(prisma, userId, cardId);
    if (!row) throw appError('NOT_FOUND');
    if (row.status === 'canceled') throw appError('CARD_CANCELED');
    await reauth.verify(userId, password, requestId);

    const pan = crypto.decryptPan(row.panEncrypted);
    await audit.record(prisma, 'CARD_REVEALED', { userId, requestId, metadata: cardEvent(row) });
    return {
      number: pan,
      expMonth: row.expMonth,
      expYear: row.expYear,
      cvv: crypto.deriveCvv({ id: row.id, pan, expMonth: row.expMonth, expYear: row.expYear }),
    };
  }

  return {
    list,
    issue,
    freeze: (userId: string, cardId: string, requestId: string) =>
      changeStatus(userId, cardId, 'freeze', requestId),
    unfreeze: (userId: string, cardId: string, requestId: string) =>
      changeStatus(userId, cardId, 'unfreeze', requestId),
    cancel: (userId: string, cardId: string, requestId: string) =>
      changeStatus(userId, cardId, 'cancel', requestId),
    rename,
    reveal,
  };
}

export type CardsService = ReturnType<typeof createCardsService>;
