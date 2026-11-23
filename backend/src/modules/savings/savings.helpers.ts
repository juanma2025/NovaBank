import type { SavingsGoal } from '@nova/db';
import { addYearsToIsoDate, bogotaToday, GOAL_DATE_MAX_YEARS, type Goal } from '@nova/shared';

import { startOfBogotaDay } from '../../lib/bogota-day.js';
import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService, AccountView } from '../accounts/accounts.service.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import { savingsRepository as repo } from './savings.repository.js';

export interface SavingsMoveInput {
  userId: string;
  goalId: string;
  amount: number;
  idempotencyKey: string;
  requestId: string;
}

export interface Outcome<T> {
  status: number;
  body: T;
  replayed: boolean;
}

export function toGoal(row: SavingsGoal, balance: number): Goal {
  const targetAmount = toSafeNumber(row.targetAmount);
  return {
    id: row.id,
    name: row.name,
    targetAmount,
    targetDate: row.targetDate ? row.targetDate.toISOString().slice(0, 10) : null,
    balance,
    completed: balance >= targetAmount,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
  };
}

/** Reglas y bloqueos compartidos por las metas y sus movimientos (spec 005, research R4, R7, R8). */
export function createSavingsHelpers(
  ctx: Pick<ModuleContext, 'config' | 'clock'>,
  deps: { accounts: AccountsService; ledger: LedgerService },
) {
  const { config, clock } = ctx;
  const { accounts, ledger } = deps;

  /** La fecha debe ser hoy o futura en Bogotá y no pasar de 10 años (research R8). */
  function assertTargetDate(targetDate: string | null | undefined): void {
    if (!targetDate) return;
    const today = bogotaToday(clock.now());
    if (targetDate < today) {
      throw appError('VALIDATION_ERROR', { fields: { targetDate: 'past' } });
    }
    if (targetDate > addYearsToIsoDate(today, GOAL_DATE_MAX_YEARS)) {
      throw appError('VALIDATION_ERROR', { fields: { targetDate: 'too_far' } });
    }
  }

  /**
   * Lo que queda del tope diario: aportes + retiros del día en Bogotá, sin las devoluciones de
   * cierre (research R7). Todas las operaciones pertenecen a la cuenta principal (R3).
   */
  async function remainingToday(db: Db, userId: string, mainAccountId: string): Promise<number> {
    const since = startOfBogotaDay(clock.now());
    const [deposits, withdrawals, closingIds] = await Promise.all([
      ledger.sumCompletedSince(db, mainAccountId, 'savings_deposit', since),
      ledger.sumCompletedSince(db, mainAccountId, 'savings_withdrawal', since),
      repo.closingTransactionIdsSince(db, userId, since),
    ]);
    const refunds = await ledger.sumTransactionAmounts(db, closingIds);
    return Math.max(0, config.savings.dailyLimit - (deposits + withdrawals - refunds));
  }

  /** Meta propia con su fila bloqueada; ajena o inexistente → 404 (FR-015). */
  async function lockGoal(tx: Db, userId: string, goalId: string): Promise<SavingsGoal> {
    const row = await repo.lockOwned(tx, userId, goalId);
    if (!row) throw appError('NOT_FOUND');
    return row;
  }

  /** Bloqueos de research R4: fila de la meta → cuenta principal y subcuenta en orden de id. */
  async function lockAll(tx: Db, userId: string, goalId: string) {
    const row = await lockGoal(tx, userId, goalId);
    const own = await accounts.ensureForUser(tx, userId);
    const [main, sub] = (await accounts.lockManyForUpdate(tx, [own.id, row.accountId])) as [
      AccountView,
      AccountView,
    ];
    return { row, main, sub };
  }

  return { assertTargetDate, remainingToday, lockGoal, lockAll };
}

export type SavingsHelpers = ReturnType<typeof createSavingsHelpers>;
