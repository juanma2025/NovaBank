import {
  MAX_ACTIVE_GOALS,
  type CreateGoalRequest,
  type Goal,
  type GoalList,
  type MovementsPage,
  type SavingsLimits,
  type UpdateGoalRequest,
} from '@nova/shared';

import { appError } from '../../lib/errors.js';
import type { IdempotencyService } from '../../lib/idempotency/idempotency.service.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import { createSavingsMovements } from './savings-movements.service.js';
import { createSavingsHelpers, toGoal } from './savings.helpers.js';
import { savingsRepository as repo } from './savings.repository.js';

export type { Outcome, SavingsMoveInput } from './savings.helpers.js';
export { toGoal } from './savings.helpers.js';

/**
 * Metas de ahorro (spec 005). Cada meta tiene una subcuenta en `accounts`; el dinero se mueve con
 * `ledger.post` entre la cuenta principal y la subcuenta (research R1–R3). No toca tablas ajenas.
 * Los movimientos de dinero viven en `savings-movements.service.ts`.
 */
export function createSavingsService(
  ctx: ModuleContext,
  deps: { accounts: AccountsService; ledger: LedgerService; idempotency: IdempotencyService },
) {
  const { config, prisma, clock, audit } = ctx;
  const { accounts, ledger } = deps;
  const helpers = createSavingsHelpers(ctx, deps);
  const movements = createSavingsMovements(ctx, deps, helpers);

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
    helpers.assertTargetDate(input.targetDate);
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

  async function update(userId: string, goalId: string, input: UpdateGoalRequest): Promise<Goal> {
    helpers.assertTargetDate(input.targetDate);
    return prisma.$transaction(async (tx) => {
      const row = await helpers.lockGoal(tx, userId, goalId);
      if (row.status === 'closed') throw appError('GOAL_CLOSED');
      const updated = await repo.update(tx, row.id, input, clock.now());
      const balances = await accounts.balancesByIds(tx, [row.accountId]);
      return toGoal(updated, balances.get(row.accountId) ?? 0);
    });
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
      remainingToday: await helpers.remainingToday(prisma, userId, own.id),
    };
  }

  return { list, create, update, listMovements, limits, ...movements };
}

export type SavingsService = ReturnType<typeof createSavingsService>;
