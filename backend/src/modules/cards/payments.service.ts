import { timingSafeEqual } from 'node:crypto';

import type { Card as CardRow, Prisma } from '@nova/db';
import {
  findMerchant,
  maskCardNumber,
  type CardPaymentResult,
  type CardPaymentsPage,
  type MerchantId,
  type PaymentLimits,
} from '@nova/shared';

import { type AttemptRule, lockedUntil } from '../../lib/attempt-lock.js';
import { startOfBogotaDay } from '../../lib/bogota-day.js';
import type { CardCrypto } from '../../lib/card-crypto.js';
import { secondsUntil } from '../../lib/clock.js';
import { decodeCursor, encodeCursor } from '../../lib/cursor.js';
import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import type { IdempotencyService } from '../../lib/idempotency/idempotency.service.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import { cardsRepository as repo } from './cards.repository.js';

const SCOPE = 'store.payments';
/** 5 rechazos por datos equivocados en 15 minutos (FR-014, research R5). */
const DECLINE_RULE: AttemptRule = { failures: 5, windowMs: 15 * 60 * 1000 };

export interface PayInput {
  userId: string;
  idempotencyKey: string;
  merchantId: MerchantId;
  amount: number;
  /** Ya sin espacios (CreateCardPaymentRequestSchema). */
  cardNumber: string;
  /** MM/AA. */
  expiry: string;
  cvv: string;
  requestId: string;
}

export interface PayOutcome {
  status: number;
  body: CardPaymentResult;
  replayed: boolean;
}

const sameText = (a: string, b: string): boolean =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Pagos en la tienda demo (spec 004, US3). No toca tablas ajenas: orquesta accounts, ledger,
 * idempotencia y su propio repositorio (research R1, R5, R6).
 */
export function createPaymentsService(
  ctx: ModuleContext,
  deps: {
    accounts: AccountsService;
    ledger: LedgerService;
    idempotency: IdempotencyService;
    crypto: CardCrypto;
  },
) {
  const { config, prisma, clock, audit } = ctx;
  const { accounts, ledger, idempotency, crypto } = deps;

  async function remainingToday(db: Db, accountId: string): Promise<number> {
    const spent = await ledger.sumCompletedSince(
      db,
      accountId,
      'card_payment',
      startOfBogotaDay(clock.now()),
    );
    return Math.max(0, config.cardPayments.dailyLimit - spent);
  }

  async function currentLock(userId: string): Promise<Date | null> {
    const until = lockedUntil(
      await repo.latestDeclines(prisma, userId, DECLINE_RULE.failures),
      DECLINE_RULE,
    );
    return until && until > clock.now() ? until : null;
  }

  const lockedError = (until: Date) =>
    appError('CARD_PAYMENTS_LOCKED', { retryAfterSeconds: secondsUntil(clock.now(), until) });

  /** La tarjeta propia cuyos número, vencimiento y CVV coinciden, o null (FR-012). */
  async function matchCard(input: PayInput): Promise<CardRow | null> {
    const card = await repo.findOwnedByPanHash(
      prisma,
      input.userId,
      crypto.panHash(input.cardNumber),
    );
    if (!card) return null;
    const expiry = `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear % 100).padStart(2, '0')}`;
    const cvv = crypto.deriveCvv({
      id: card.id,
      pan: input.cardNumber,
      expMonth: card.expMonth,
      expYear: card.expYear,
    });
    // Se comparan ambos siempre: el tiempo no revela cuál dato falló.
    const expiryOk = sameText(input.expiry, expiry);
    const cvvOk = sameText(input.cvv, cvv);
    return expiryOk && cvvOk ? card : null;
  }

  /** GET /store/limits (FR-015). */
  async function limits(userId: string): Promise<PaymentLimits> {
    const account = await accounts.ensureForUser(prisma, userId);
    const { minAmount, maxAmount, dailyLimit } = config.cardPayments;
    return {
      minAmount,
      maxAmount,
      dailyLimit,
      remainingToday: await remainingToday(prisma, account.id),
    };
  }

  /** POST /store/payments: flujo de research R6. */
  async function pay(input: PayInput): Promise<PayOutcome> {
    const { minAmount, maxAmount } = config.cardPayments;
    if (input.amount < minAmount || input.amount > maxAmount) {
      throw appError('PAYMENT_AMOUNT_OUT_OF_RANGE', { minAmount, maxAmount });
    }
    const activeLock = await currentLock(input.userId);
    if (activeLock) throw lockedError(activeLock);

    const card = await matchCard(input);
    if (!card) {
      // Fuera de la transacción: el rechazo cuenta aunque no se mueva dinero (research R5).
      await repo.insertDecline(prisma, input.userId, clock.now());
      const newLock = await currentLock(input.userId);
      throw newLock ? lockedError(newLock) : appError('CARD_DECLINED');
    }

    return prisma.$transaction(
      async (tx) => {
        const own = await accounts.ensureForUser(tx, input.userId);
        const account = await accounts.lockForUpdate(tx, own.id);
        // La fila de la tarjeta bloqueada: congelar o cancelar espera o ya se aplicó (R6).
        const locked = await repo.lockOwned(tx, input.userId, card.id);
        if (!locked) throw appError('CARD_DECLINED');

        // Nunca el número ni el CVV en el hash (research R6).
        const begun = await idempotency.begin(tx, {
          userId: input.userId,
          scope: SCOPE,
          key: input.idempotencyKey,
          body: { merchantId: input.merchantId, amount: input.amount, cardId: locked.id },
        });
        if (begun.kind === 'replay') {
          return {
            status: begun.status,
            body: begun.body as unknown as CardPaymentResult,
            replayed: true,
          };
        }

        // Regla de dominio 8: una tarjeta congelada o cancelada rechaza toda autorización.
        if (locked.status !== 'active') throw appError('CARD_NOT_ACTIVE');
        const left = await remainingToday(tx, account.id);
        if (input.amount > left) throw appError('PAYMENT_DAILY_LIMIT', { remainingToday: left });
        if (input.amount > account.balance) {
          throw appError('INSUFFICIENT_FUNDS', { availableBalance: account.balance });
        }

        const merchant = findMerchant(input.merchantId);
        const description = `Compra en ${merchant.name} · ${maskCardNumber(locked.last4)}`;
        const systemId = await accounts.getSystemMerchantsAccountId(tx);
        const movement = await ledger.post(tx, {
          type: 'card_payment',
          accountId: account.id,
          amount: input.amount,
          description,
          lines: [
            { accountId: account.id, amount: -input.amount, description },
            { accountId: systemId, amount: input.amount, description },
          ],
          requestId: input.requestId,
        });
        await repo.insertPayment(tx, {
          cardId: locked.id,
          transactionId: movement.transactionId,
          merchantId: merchant.id,
          merchantName: merchant.name,
          category: merchant.category,
          amount: BigInt(input.amount),
          now: clock.now(),
        });
        await audit.record(tx, 'CARD_PAYMENT_APPROVED', {
          userId: input.userId,
          requestId: input.requestId,
          metadata: {
            amount: input.amount,
            transactionId: movement.transactionId,
            cardId: locked.id,
            merchantId: merchant.id,
          },
        });

        const body: CardPaymentResult = {
          movement,
          balance: account.balance - input.amount,
          cardLast4: locked.last4,
        };
        await idempotency.complete(tx, begun.id, 201, body as unknown as Prisma.InputJsonValue);
        return { status: 201, body, replayed: false };
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }

  /** GET /cards/{cardId}/payments (FR-020). */
  async function listCardPayments(
    userId: string,
    cardId: string,
    { cursor, limit }: { cursor?: string | undefined; limit: number },
  ): Promise<CardPaymentsPage> {
    const card = await repo.findOwned(prisma, userId, cardId);
    if (!card) throw appError('NOT_FOUND');
    const after = cursor ? decodeCursor(cursor) : undefined;
    const rows = await repo.listPayments(prisma, card.id, limit + 1, after);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((p) => ({
        id: p.id,
        transactionId: p.transactionId,
        merchantId: p.merchantId as MerchantId,
        merchantName: p.merchantName,
        category: p.category,
        amount: toSafeNumber(p.amount),
        createdAt: p.createdAt.toISOString(),
      })),
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
    };
  }

  /** Limpieza de rechazos de más de 24 h (data-model.md, CardPaymentDecline). */
  function deleteOldDeclines(now: Date): Promise<number> {
    return repo.deleteDeclinesBefore(prisma, new Date(now.getTime() - 24 * 60 * 60 * 1000));
  }

  return { limits, pay, listCardPayments, deleteOldDeclines };
}

export type PaymentsService = ReturnType<typeof createPaymentsService>;
