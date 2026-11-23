import type { Prisma } from '@nova/db';
import type { CloseGoalResult, SavingsMovementResult } from '@nova/shared';

import { appError } from '../../lib/errors.js';
import type { IdempotencyService } from '../../lib/idempotency/idempotency.service.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { LedgerService } from '../ledger/ledger.service.js';
import {
  toGoal,
  type Outcome,
  type SavingsHelpers,
  type SavingsMoveInput,
} from './savings.helpers.js';
import { savingsRepository as repo } from './savings.repository.js';

type Direction = 'deposit' | 'withdrawal';

/**
 * Movimientos de dinero de las metas (spec 005): aportes, retiros y la devolución al cerrar, como
 * asientos del libro entre la cuenta principal y la subcuenta (research R3, R5–R7).
 */
export function createSavingsMovements(
  ctx: ModuleContext,
  deps: { ledger: LedgerService; idempotency: IdempotencyService },
  helpers: SavingsHelpers,
) {
  const { config, prisma, clock, audit } = ctx;
  const { ledger, idempotency } = deps;

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
        const { row, main, sub } = await helpers.lockAll(tx, input.userId, input.goalId);
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
        const left = await helpers.remainingToday(tx, input.userId, main.id);
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
        const { row, main, sub } = await helpers.lockAll(tx, userId, goalId);
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

  return {
    deposit: (input: SavingsMoveInput) => move('deposit', input),
    withdraw: (input: SavingsMoveInput) => move('withdrawal', input),
    close,
  };
}
