import type { Card, CardPayment, CardStatus, MerchantCategory } from '@nova/db';

import type { CursorPosition } from '../../lib/cursor.js';
import type { Db } from '../../lib/db.js';

export interface NewCard {
  userId: string;
  nickname: string;
  last4: string;
  panEncrypted: Uint8Array<ArrayBuffer>;
  panHash: string;
  expMonth: number;
  expYear: number;
  now: Date;
}

export interface NewCardPayment {
  cardId: string;
  transactionId: string;
  merchantId: string;
  merchantName: string;
  category: MerchantCategory;
  amount: bigint;
  now: Date;
}

/**
 * Acceso a `cards`, `card_payments` y `card_payment_declines` (spec 004, data-model.md). Dueño:
 * módulo cards. Toda búsqueda de una tarjeta filtra por su dueño (FR-010).
 */
export const cardsRepository = {
  create(db: Db, card: NewCard): Promise<Card> {
    return db.card.create({
      data: {
        userId: card.userId,
        nickname: card.nickname,
        last4: card.last4,
        panEncrypted: card.panEncrypted,
        panHash: card.panHash,
        expMonth: card.expMonth,
        expYear: card.expYear,
        status: 'active',
        createdAt: card.now,
        updatedAt: card.now,
      },
    });
  },

  async existsByPanHash(db: Db, panHash: string): Promise<boolean> {
    return (await db.card.count({ where: { panHash } })) > 0;
  },

  listByUser(db: Db, userId: string): Promise<Card[]> {
    return db.card.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  },

  countActive(db: Db, userId: string): Promise<number> {
    return db.card.count({ where: { userId, status: { not: 'canceled' } } });
  },

  findOwned(db: Db, userId: string, id: string): Promise<Card | null> {
    return db.card.findFirst({ where: { id, userId } });
  },

  findOwnedByPanHash(db: Db, userId: string, panHash: string): Promise<Card | null> {
    return db.card.findFirst({ where: { panHash, userId } });
  },

  /** Bloquea la fila (SQL explícito: SELECT … FOR UPDATE, research R6) y la devuelve. */
  async lockOwned(db: Db, userId: string, id: string): Promise<Card | null> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM cards WHERE id = ${id}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
    return rows[0] ? db.card.findUnique({ where: { id } }) : null;
  },

  /** Transiciones de research R8; el trigger de la base rechaza cambiar una cancelada. */
  updateStatus(db: Db, id: string, status: CardStatus, now: Date): Promise<Card> {
    return db.card.update({
      where: { id },
      data: { status, updatedAt: now, ...(status === 'canceled' ? { canceledAt: now } : {}) },
    });
  },

  updateNickname(db: Db, id: string, nickname: string, now: Date): Promise<Card> {
    return db.card.update({ where: { id }, data: { nickname, updatedAt: now } });
  },

  async insertPayment(db: Db, payment: NewCardPayment): Promise<CardPayment> {
    return db.cardPayment.create({
      data: {
        cardId: payment.cardId,
        transactionId: payment.transactionId,
        merchantId: payment.merchantId,
        merchantName: payment.merchantName,
        category: payment.category,
        amount: payment.amount,
        createdAt: payment.now,
      },
    });
  },

  /** Página por cursor en orden (created_at DESC, id DESC). */
  listPayments(
    db: Db,
    cardId: string,
    take: number,
    after?: CursorPosition,
  ): Promise<CardPayment[]> {
    return db.cardPayment.findMany({
      where: {
        cardId,
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });
  },

  async insertDecline(db: Db, userId: string, now: Date): Promise<void> {
    await db.cardPaymentDecline.create({ data: { userId, createdAt: now } });
  },

  /** Fechas de los `limit` rechazos más recientes del usuario. */
  async latestDeclines(db: Db, userId: string, limit: number): Promise<Date[]> {
    const rows = await db.cardPaymentDecline.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { createdAt: true },
    });
    return rows.map((r) => r.createdAt);
  },

  async deleteDeclinesBefore(db: Db, before: Date): Promise<number> {
    const result = await db.cardPaymentDecline.deleteMany({ where: { createdAt: { lt: before } } });
    return result.count;
  },
};
