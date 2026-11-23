import type { Prisma } from '@nova/db';
import type { TopupLimits, TopupResult } from '@nova/shared';

import { startOfBogotaDay } from '../../lib/bogota-day.js';
import { appError } from '../../lib/errors.js';
import type { IdempotencyService } from '../../lib/idempotency/idempotency.service.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import type { LedgerService } from '../ledger/ledger.service.js';

const SCOPE = 'topups.create';
const DESCRIPTION = 'Recarga simulada';

export interface CreateTopupInput {
  userId: string;
  idempotencyKey: string;
  amount: number;
  requestId: string;
}

export interface CreateTopupOutcome {
  status: number;
  body: TopupResult;
  replayed: boolean;
}

/**
 * Recarga simulada (US2). No toca tablas: orquesta accounts, ledger e idempotencia dentro de UNA
 * transacción (plan.md, «Flujo de POST /topups»; research R1–R5, R7).
 */
export function createTopupsService(
  ctx: ModuleContext,
  deps: { accounts: AccountsService; ledger: LedgerService; idempotency: IdempotencyService },
) {
  const { config, prisma, clock, audit } = ctx;
  const { accounts, ledger, idempotency } = deps;

  async function remainingToday(
    db: Parameters<LedgerService['sumCompletedSince']>[0],
    accountId: string,
  ) {
    const used = await ledger.sumCompletedSince(
      db,
      accountId,
      'topup',
      startOfBogotaDay(clock.now()),
    );
    return Math.max(0, config.topups.dailyLimit - used);
  }

  /** GET /topups/limits: límites vigentes y lo que le queda hoy al estudiante (FR-009, FR-010). */
  async function limits(userId: string): Promise<TopupLimits> {
    const account = await accounts.ensureForUser(prisma, userId);
    return {
      minAmount: config.topups.minAmount,
      maxAmount: config.topups.maxAmount,
      dailyLimit: config.topups.dailyLimit,
      remainingToday: await remainingToday(prisma, account.id),
    };
  }

  async function create(input: CreateTopupInput): Promise<CreateTopupOutcome> {
    return prisma.$transaction(
      async (tx) => {
        const own = await accounts.ensureForUser(tx, input.userId);
        // Bloqueo de la cuenta del estudiante: serializa saldo y tope diario (research R4).
        const account = await accounts.lockForUpdate(tx, own.id);

        const begun = await idempotency.begin(tx, {
          userId: input.userId,
          scope: SCOPE,
          key: input.idempotencyKey,
          body: { amount: input.amount },
        });
        if (begun.kind === 'replay') {
          return {
            status: begun.status,
            body: begun.body as unknown as TopupResult,
            replayed: true,
          };
        }

        const { minAmount, maxAmount } = config.topups;
        if (input.amount < minAmount || input.amount > maxAmount) {
          throw appError('TOPUP_AMOUNT_OUT_OF_RANGE', { minAmount, maxAmount });
        }
        const left = await remainingToday(tx, account.id);
        if (input.amount > left) {
          throw appError('TOPUP_DAILY_LIMIT', { remainingToday: left });
        }

        const systemId = await accounts.getSystemTopupsAccountId(tx);
        const movement = await ledger.post(tx, {
          type: 'topup',
          accountId: account.id,
          amount: input.amount,
          description: DESCRIPTION,
          lines: [
            { accountId: account.id, amount: input.amount },
            { accountId: systemId, amount: -input.amount },
          ],
          requestId: input.requestId,
        });
        await audit.record(tx, 'TOPUP_COMPLETED', {
          userId: input.userId,
          requestId: input.requestId,
          metadata: { amount: input.amount, transactionId: movement.transactionId },
        });

        const body: TopupResult = { movement, balance: account.balance + input.amount };
        await idempotency.complete(tx, begun.id, 201, body as unknown as Prisma.InputJsonValue);
        return { status: 201, body, replayed: false };
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }

  return { limits, create };
}

export type TopupsService = ReturnType<typeof createTopupsService>;
