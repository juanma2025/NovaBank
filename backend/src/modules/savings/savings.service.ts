import type { Prisma, SavingsGoal } from '@nova/db';
import {
  addYearsToIsoDate,
  bogotaToday,
  GOAL_DATE_MAX_YEARS,
  MAX_ACTIVE_GOALS,
  type CloseGoalResult,
  type CreateGoalRequest,
  type Goal,
  type GoalList,
  type MovementsPage,
  type SavingsLimits,
  type SavingsMovementResult,
  type UpdateGoalRequest,
} from '@nova/shared';

import { startOfBogotaDay } from '../../lib/bogota-day.js';
import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import type { IdempotencyService } from '../../lib/idempotency/idempotency.service.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService, AccountView } from '../accounts/accounts.service.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import { savingsRepository as repo } from './savings.repository.js';

type Direction = 'deposit' | 'withdrawal';

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

/**
 * Metas de ahorro (spec 005). Cada meta tiene una subcuenta en `accounts`; el dinero se mueve con
 * `ledger.post` entre la cuenta principal y la subcuenta (research R1–R3). No toca tablas ajenas.
 */
export function createSavingsService(
  ctx: ModuleContext,
  deps: { accounts: AccountsService; ledger: LedgerService; idempotency: IdempotencyService },
) {
  const { config, prisma, clock, audit } = ctx;
  const { accounts, ledger, idempotency } = deps;

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

  async function list(userId: string): Promise<GoalList> {
    const rows = await repo.listByUser(prisma, userId);
    const balances = await accounts.balancesByIds(
      prisma,
      rows.map((r) => r.accountId),
    );
    const goals = rows.map((row) => toGoal(row, balances.get(row.accountId) ?? 0));
    const active = goals.filter((g) => g.status === 'active');
    return {
      items: [...active, ...goals.filter((g) => g.status === 'closed')],
      totalSaved: active.reduce((sum, g) => sum + g.balance, 0),
    };
  }

  /** FR-001, FR-002: máximo 5 activas, contadas con la cuenta principal bloqueada (R4). */
  async function create(
    userId: string,
    input: CreateGoalRequest,
    requestId: string,
  ): Promise<Goal> {
    assertTargetDate(input.targetDate);
    return prisma.$transaction(async (tx) => {
      const own = await accounts.ensureForUser(tx, userId);
      await accounts.lockForUpdate(tx, own.id);
      if ((await repo.countActive(tx, userId)) >= MAX_ACTIVE_GOALS) {
        throw appError('GOAL_LIMIT_REACHED');
      }
      const subaccount = await accounts.createSavingsAccount(tx);
      const row = await repo.create(tx, {
        userId,
        accountId: subaccount.id,
        name: input.name,
        targetAmount: input.targetAmount,
        targetDate: input.targetDate ?? null,
        now: clock.now(),
      });
      await audit.record(tx, 'GOAL_CREATED', { userId, requestId, metadata: { goalId: row.id } });
      return toGoal(row, 0);
    });
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

  async function update(userId: string, goalId: string, input: UpdateGoalRequest): Promise<Goal> {
    assertTargetDate(input.targetDate);
    return prisma.$transaction(async (tx) => {
      const row = await lockGoal(tx, userId, goalId);
      if (row.status === 'closed') throw appError('GOAL_CLOSED');
      const updated = await repo.update(tx, row.id, input, clock.now());
      const balances = await accounts.balancesByIds(tx, [row.accountId]);
      return toGoal(updated, balances.get(row.accountId) ?? 0);
    });
  }

  /** Aporte o retiro (research R5). */
  async function move(
    direction: Direction,
    input: SavingsMoveInput,
  ): Promise<Outcome<SavingsMovementResult>> {
    const { minAmount, maxAmount } = config.savings;
    if (input.amount < minAmount || input.amount > maxAmount) {
      throw appError('SAVINGS_AMOUNT_OUT_OF_RANGE', { minAmount, maxAmount });
    }

    return prisma.$transaction(
      async (tx) => {
        const { row, main, sub } = await lockAll(tx, input.userId, input.goalId);
        const begun = await idempotency.begin(tx, {
          userId: input.userId,
          scope: `savings.${direction}`,
          key: input.idempotencyKey,
          body: { goalId: row.id, amount: input.amount },
        });
        if (begun.kind === 'replay') {
          return {
            status: begun.status,
            body: begun.body as unknown as SavingsMovementResult,
            replayed: true,
          };
        }

        if (row.status === 'closed') throw appError('GOAL_CLOSED');
        const left = await remainingToday(tx, input.userId, main.id);
        if (input.amount > left) throw appError('SAVINGS_DAILY_LIMIT', { remainingToday: left });
        const source = direction === 'deposit' ? main : sub;
        if (input.amount > source.balance) {
          throw appError('INSUFFICIENT_FUNDS', { availableBalance: source.balance });
        }

        const isDeposit = direction === 'deposit';
        const mainDescription = isDeposit ? `Aporte a ${row.name}` : `Retiro de ${row.name}`;
        const movement = await ledger.post(tx, {
          type: isDeposit ? 'savings_deposit' : 'savings_withdrawal',
          accountId: main.id,
          amount: input.amount,
          description: mainDescription,
          lines: [
            {
              accountId: main.id,
              amount: isDeposit ? -input.amount : input.amount,
              description: mainDescription,
            },
            {
              accountId: sub.id,
              amount: isDeposit ? input.amount : -input.amount,
              description: isDeposit ? 'Aporte desde tu cuenta' : 'Retiro a tu cuenta',
            },
          ],
          requestId: input.requestId,
        });
        await audit.record(tx, isDeposit ? 'SAVINGS_DEPOSIT' : 'SAVINGS_WITHDRAWAL', {
          userId: input.userId,
          requestId: input.requestId,
          metadata: { goalId: row.id, amount: input.amount, transactionId: movement.transactionId },
        });

        const delta = isDeposit ? input.amount : -input.amount;
        const body: SavingsMovementResult = {
          goal: toGoal(row, sub.balance + delta),
          movement,
          availableBalance: main.balance - delta,
        };
        await idempotency.complete(tx, begun.id, 201, body as unknown as Prisma.InputJsonValue);
        return { status: 201, body, replayed: false };
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }

  /** Cierre con devolución de todo el saldo, exenta de límites (research R6, R7). */
  async function close(
    userId: string,
    goalId: string,
    idempotencyKey: string,
    requestId: string,
  ): Promise<Outcome<CloseGoalResult>> {
    return prisma.$transaction(
      async (tx) => {
        const { row, main, sub } = await lockAll(tx, userId, goalId);
        const begun = await idempotency.begin(tx, {
          userId,
          scope: 'savings.close',
          key: idempotencyKey,
          body: { goalId: row.id },
        });
        if (begun.kind === 'replay') {
          return {
            status: begun.status,
            body: begun.body as unknown as CloseGoalResult,
            replayed: true,
          };
        }
        if (row.status === 'closed') throw appError('GOAL_CLOSED');

        const returned = sub.balance;
        const movement =
          returned > 0
            ? await ledger.post(tx, {
                type: 'savings_withdrawal',
                accountId: main.id,
                amount: returned,
                description: `Cierre de ${row.name}`,
                lines: [
                  { accountId: main.id, amount: returned, description: `Cierre de ${row.name}` },
                  {
                    accountId: sub.id,
                    amount: -returned,
                    description: 'Cierre: devolución a tu cuenta',
                  },
                ],
                requestId,
              })
            : null;
        const closed = await repo.close(tx, row.id, movement?.transactionId ?? null, clock.now());
        await audit.record(tx, 'GOAL_CLOSED', {
          userId,
          requestId,
          metadata: {
            goalId: row.id,
            returnedAmount: returned,
            transactionId: movement?.transactionId ?? null,
          },
        });

        const body: CloseGoalResult = {
          goal: toGoal(closed, 0),
          movement,
          availableBalance: main.balance + returned,
        };
        await idempotency.complete(tx, begun.id, 200, body as unknown as Prisma.InputJsonValue);
        return { status: 200, body, replayed: false };
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }

  /** Historial visto desde la subcuenta de la meta (FR-014). */
  async function listMovements(
    userId: string,
    goalId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<MovementsPage> {
    const row = await repo.findOwned(prisma, userId, goalId);
    if (!row) throw appError('NOT_FOUND');
    return ledger.listMovements(prisma, row.accountId, query);
  }

  async function limits(userId: string): Promise<SavingsLimits> {
    const own = await accounts.ensureForUser(prisma, userId);
    const { minAmount, maxAmount, dailyLimit } = config.savings;
    return {
      minAmount,
      maxAmount,
      dailyLimit,
      remainingToday: await remainingToday(prisma, userId, own.id),
    };
  }

  return {
    list,
    create,
    update,
    deposit: (input: SavingsMoveInput) => move('deposit', input),
    withdraw: (input: SavingsMoveInput) => move('withdrawal', input),
    close,
    listMovements,
    limits,
  };
}

export type SavingsService = ReturnType<typeof createSavingsService>;
