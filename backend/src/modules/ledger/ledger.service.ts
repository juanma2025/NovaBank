import type { LedgerTransaction, LedgerTransactionType } from '@nova/db';
import type { Movement, MovementsPage } from '@nova/shared';

import type { Db } from '../../lib/db.js';
import { decodeCursor, encodeCursor } from '../../lib/cursor.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import { ledgerRepository as repo, type EntryWithTransaction } from './ledger.repository.js';

/** Operación del libro vista por otros módulos (spec 006). */
export interface LedgerOperation {
  id: string;
  type: LedgerTransactionType;
  status: LedgerTransaction['status'];
  /** Cuenta que origina la operación (en una transferencia, quien envía). */
  accountId: string;
  amount: number;
  description: string;
  createdAt: Date;
}

export interface PostInput {
  type: LedgerTransactionType;
  /** Cuenta del estudiante que origina la operación. */
  accountId: string;
  amount: number;
  description: string;
  /** Spec 003: cuenta del destinatario de una transferencia. */
  counterpartyAccountId?: string;
  /** Spec 003: nota opcional de la transferencia. */
  note?: string | null;
  /**
   * Asientos con signo; deben sumar cero (la base lo exige al confirmar). `description` es el texto
   * visto desde la cuenta del asiento (spec 003, research R5).
   */
  lines: { accountId: string; amount: number; description?: string }[];
  requestId: string;
}

function toMovement(entry: EntryWithTransaction): Movement {
  return {
    id: entry.id,
    transactionId: entry.transactionId,
    type: entry.transaction.type,
    // La del asiento si existe (transferencias); si no, la de la operación (data-model.md, Movement).
    description: entry.description ?? entry.transaction.description,
    note: entry.transaction.note,
    amount: toSafeNumber(entry.amount),
    status: entry.transaction.status,
    createdAt: entry.createdAt.toISOString(),
  };
}

/**
 * Libro contable de doble entrada (spec 002, research R2). Actualiza saldos solo a través del
 * servicio público de accounts (Principio VI).
 */
export function createLedgerService(
  ctx: Pick<ModuleContext, 'clock'>,
  deps: { accounts: AccountsService },
) {
  /**
   * Registra una operación: `pending` → asientos → saldos → `completed`, todo en la transacción
   * `tx` del llamador. Devuelve el movimiento visto desde la cuenta de origen.
   */
  async function post(tx: Db, input: PostInput): Promise<Movement> {
    const now = ctx.clock.now();
    const transaction = await repo.createTransaction(tx, {
      type: input.type,
      status: 'pending',
      accountId: input.accountId,
      amount: BigInt(input.amount),
      description: input.description,
      counterpartyAccountId: input.counterpartyAccountId ?? null,
      note: input.note ?? null,
      requestId: input.requestId,
      createdAt: now,
    });
    await repo.createEntries(
      tx,
      input.lines.map((line) => ({
        transactionId: transaction.id,
        accountId: line.accountId,
        amount: BigInt(line.amount),
        description: line.description ?? null,
        createdAt: now,
      })),
    );
    for (const line of input.lines) {
      await deps.accounts.applyBalanceDelta(tx, line.accountId, line.amount);
    }
    await repo.completeTransaction(tx, transaction.id, now);
    const entry = await repo.findEntry(tx, transaction.id, input.accountId);
    if (!entry) throw new Error('la operación no tiene asiento en la cuenta de origen');
    return toMovement(entry);
  }

  async function recentMovements(db: Db, accountId: string, limit: number): Promise<Movement[]> {
    return (await repo.listEntries(db, accountId, limit)).map(toMovement);
  }

  /** Historial paginado por cursor, estable ante movimientos nuevos (FR-020, research R8). */
  async function listMovements(
    db: Db,
    accountId: string,
    { cursor, limit }: { cursor?: string | undefined; limit: number },
  ): Promise<MovementsPage> {
    const after = cursor ? decodeCursor(cursor) : undefined;
    const rows = await repo.listEntries(db, accountId, limit + 1, after);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(toMovement),
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
    };
  }

  async function sumCompletedSince(
    db: Db,
    accountId: string,
    type: LedgerTransactionType,
    since: Date,
  ): Promise<number> {
    return toSafeNumber(await repo.sumCompletedSince(db, accountId, type, since));
  }

  /** Spec 005: suma de los montos de las operaciones dadas (devoluciones de cierre, R7). */
  async function sumTransactionAmounts(db: Db, transactionIds: string[]): Promise<number> {
    return toSafeNumber(await repo.sumAmountsByIds(db, transactionIds));
  }

  /** Vista pública de una operación para otros módulos (spec 006, research R1). */
  function toOperation(tx: LedgerTransaction): LedgerOperation {
    return {
      id: tx.id,
      type: tx.type,
      status: tx.status,
      accountId: tx.accountId,
      amount: toSafeNumber(tx.amount),
      description: tx.description,
      createdAt: tx.createdAt,
    };
  }

  /** Operaciones completadas de una cuenta y tipo en [desde, hasta) (spec 006, research R3). */
  async function completedTransactions(
    db: Db,
    accountId: string,
    type: LedgerTransactionType,
    range: { from: Date; to: Date },
  ): Promise<LedgerOperation[]> {
    return (await repo.listCompletedBetween(db, accountId, type, range)).map(toOperation);
  }

  /** Igual que `completedTransactions`, por páginas con cursor. */
  async function pageCompletedTransactions(
    db: Db,
    accountId: string,
    type: LedgerTransactionType,
    range: { from: Date; to: Date },
    { cursor, limit }: { cursor?: string | undefined; limit: number },
  ): Promise<{ items: LedgerOperation[]; nextCursor: string | null }> {
    const after = cursor ? decodeCursor(cursor) : undefined;
    const rows = await repo.listCompletedBetween(db, accountId, type, range, {
      take: limit + 1,
      after,
    });
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(toOperation),
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
    };
  }

  async function findTransaction(db: Db, id: string): Promise<LedgerOperation | null> {
    const tx = await repo.findTransaction(db, id);
    return tx ? toOperation(tx) : null;
  }

  return {
    post,
    recentMovements,
    listMovements,
    sumCompletedSince,
    sumTransactionAmounts,
    completedTransactions,
    pageCompletedTransactions,
    findTransaction,
  };
}

export type LedgerService = ReturnType<typeof createLedgerService>;
