import type { LedgerTransactionType } from '@nova/db';
import type { Movement, MovementsPage } from '@nova/shared';

import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import { ledgerRepository as repo, type EntryWithTransaction } from './ledger.repository.js';

export interface PostInput {
  type: LedgerTransactionType;
  /** Cuenta del estudiante que origina la operación. */
  accountId: string;
  amount: number;
  description: string;
  /** Asientos con signo; deben sumar cero (la base lo exige al confirmar). */
  lines: { accountId: string; amount: number }[];
  requestId: string;
}

function toMovement(entry: EntryWithTransaction): Movement {
  return {
    id: entry.id,
    transactionId: entry.transactionId,
    type: entry.transaction.type,
    description: entry.transaction.description,
    amount: toSafeNumber(entry.amount),
    status: entry.transaction.status,
    createdAt: entry.createdAt.toISOString(),
  };
}

function encodeCursor(entry: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify([entry.createdAt.toISOString(), entry.id])).toString(
    'base64url',
  );
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(parsed) && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
      const createdAt = new Date(parsed[0]);
      if (!Number.isNaN(createdAt.getTime()) && /^[0-9a-f-]{36}$/i.test(parsed[1])) {
        return { createdAt, id: parsed[1] };
      }
    }
  } catch {
    // cae al error de validación
  }
  throw appError('VALIDATION_ERROR', { fields: { cursor: 'invalid' } });
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
      requestId: input.requestId,
      createdAt: now,
    });
    await repo.createEntries(
      tx,
      input.lines.map((line) => ({
        transactionId: transaction.id,
        accountId: line.accountId,
        amount: BigInt(line.amount),
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

  return { post, recentMovements, listMovements, sumCompletedSince };
}

export type LedgerService = ReturnType<typeof createLedgerService>;
