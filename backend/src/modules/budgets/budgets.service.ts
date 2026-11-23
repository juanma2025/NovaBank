import type { BudgetAlert as AlertRow } from '@nova/db';
import {
  addMonths,
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_LABELS,
  BUDGET_HISTORY_MONTHS,
  BUDGET_WARNING_PERCENT,
  bogotaMonth,
  budgetStatus,
  formatCOP,
  merchantToBudgetCategory,
  type BudgetAlert,
  type BudgetCategory,
  type BudgetMonth,
  type BudgetTransfer,
  type BudgetTransfersPage,
  type MerchantCategory,
} from '@nova/shared';

import type { Db } from '../../lib/db.js';
import { appError } from '../../lib/errors.js';
import { outboxRepository } from '../../lib/mail/outbox.repository.js';
import { toSafeNumber } from '../../lib/money.js';
import type { ModuleContext } from '../../lib/module-context.js';
import type { AccountsService } from '../accounts/accounts.service.js';
import type { AuthDirectory } from '../auth/auth.directory.js';
import type { PaymentsService } from '../cards/payments.service.js';
import type { LedgerOperation, LedgerService } from '../ledger/ledger.service.js';
import { budgetsRepository as repo } from './budgets.repository.js';

/** [desde, hasta) del mes `AAAA-MM` en Bogotá (UTC−5, sin horario de verano). */
function monthRange(month: string): { from: Date; to: Date } {
  return {
    from: new Date(`${month}-01T00:00:00-05:00`),
    to: new Date(`${addMonths(month, 1)}-01T00:00:00-05:00`),
  };
}

function toAlert(row: AlertRow): BudgetAlert {
  return {
    id: row.id,
    month: row.month,
    category: row.category,
    threshold: row.threshold === 100 ? 100 : 80,
    spent: toSafeNumber(row.spent),
    limit: toSafeNumber(row.monthlyLimit),
    createdAt: row.createdAt.toISOString(),
    seen: row.seenAt !== null,
  };
}

/**
 * Presupuesto mensual por categorías (spec 006). Informativo: no mueve dinero ni bloquea gastos
 * (regla de dominio 10). Lee los gastos con las consultas públicas de `cards` y `ledger` (R1, R3).
 */
export function createBudgetsService(
  ctx: ModuleContext,
  deps: {
    accounts: AccountsService;
    ledger: LedgerService;
    payments: PaymentsService;
    directory: AuthDirectory;
  },
) {
  const { prisma, clock } = ctx;
  const { accounts, ledger, payments, directory } = deps;

  const currentMonth = (): string => bogotaMonth(clock.now());

  /** El mes actual o uno de los 6 anteriores (research R8). */
  function resolveMonth(month: string | undefined): string {
    const current = currentMonth();
    if (month === undefined) return current;
    if (month > current || month < addMonths(current, -BUDGET_HISTORY_MONTHS)) {
      throw appError('VALIDATION_ERROR', { fields: { month: 'out_of_range' } });
    }
    return month;
  }

  async function sentTransfers(db: Db, userId: string, month: string) {
    const own = await accounts.ensureForUser(db, userId);
    return ledger.completedTransactions(db, own.id, 'transfer', monthRange(month));
  }

  /** Resumen de un mes (research R3, R4, R7). */
  async function summarize(db: Db, userId: string, month: string): Promise<BudgetMonth> {
    const [cardSpending, transfers, limits] = await Promise.all([
      payments.spendingByCategory(db, userId, monthRange(month)),
      sentTransfers(db, userId, month),
      repo.limitsFor(db, userId, month),
    ]);
    const overrides = await repo.categoriesFor(
      db,
      transfers.map((t) => t.id),
    );

    const spent = new Map<BudgetCategory, number>(BUDGET_CATEGORIES.map((c) => [c, 0]));
    for (const [category, total] of Object.entries(cardSpending)) {
      const key = merchantToBudgetCategory(category as MerchantCategory);
      spent.set(key, (spent.get(key) ?? 0) + (total ?? 0));
    }
    for (const transfer of transfers) {
      const key = overrides.get(transfer.id) ?? 'transfers';
      spent.set(key, (spent.get(key) ?? 0) + transfer.amount);
    }

    const categories = BUDGET_CATEGORIES.map((category) => {
      const raw = limits.get(category);
      const limit = raw === undefined || raw === null ? null : toSafeNumber(raw);
      const total = spent.get(category) ?? 0;
      return { category, spent: total, limit, ...budgetStatus(total, limit) };
    });
    return {
      month,
      totalSpent: categories.reduce((sum, c) => sum + c.spent, 0),
      categories,
    };
  }

  /**
   * Crea las alertas nuevas del mes actual y encola su correo en la misma transacción (research R5,
   * R6). Dos evaluaciones simultáneas generan una sola alerta por umbral gracias al índice único.
   */
  async function evaluateCurrentMonth(userId: string): Promise<void> {
    const month = currentMonth();
    await prisma.$transaction(async (tx) => {
      const summary = await summarize(tx, userId, month);
      let email: string | null = null;
      for (const c of summary.categories) {
        if (c.limit === null || c.percent === null) continue;
        const thresholds: (80 | 100)[] = [];
        if (c.percent >= BUDGET_WARNING_PERCENT) thresholds.push(80);
        if (c.spent > c.limit) thresholds.push(100);
        for (const threshold of thresholds) {
          const id = await repo.insertAlertIfNew(tx, {
            userId,
            month,
            category: c.category,
            threshold,
            spent: c.spent,
            monthlyLimit: c.limit,
            now: clock.now(),
          });
          if (!id) continue;
          email ??= (await directory.findById(tx, userId))?.email ?? null;
          if (!email) continue;
          await outboxRepository.enqueue(tx, {
            template: 'budget_alert',
            to: email,
            payload: {
              categoryName: BUDGET_CATEGORY_LABELS[c.category],
              kind: threshold === 100 ? 'exceeded' : 'warning',
              percent: c.percent,
              spent: formatCOP(c.spent),
              limit: formatCOP(c.limit),
            },
            now: clock.now(),
          });
        }
      }
    });
  }

  async function monthSummary(userId: string, month?: string): Promise<BudgetMonth> {
    return summarize(prisma, userId, resolveMonth(month));
  }

  /** Pone o quita el tope desde el mes actual (FR-005) y evalúa las alertas (FR-012). */
  async function changeLimit(
    userId: string,
    category: BudgetCategory,
    monthlyLimit: number | null,
  ): Promise<BudgetMonth> {
    const month = currentMonth();
    await repo.upsertLimit(prisma, { userId, category, month }, monthlyLimit, clock.now());
    if (monthlyLimit !== null) await evaluateCurrentMonth(userId);
    return summarize(prisma, userId, month);
  }

  async function listAlerts(userId: string): Promise<BudgetAlert[]> {
    return (await repo.listAlerts(prisma, userId, currentMonth())).map(toAlert);
  }

  async function markSeen(userId: string, alertId: string): Promise<BudgetAlert> {
    const row = await repo.findAlert(prisma, userId, alertId);
    if (!row) throw appError('NOT_FOUND');
    return toAlert(row.seenAt ? row : await repo.markSeen(prisma, row.id, clock.now()));
  }

  function toTransfer(op: LedgerOperation, category: BudgetCategory): BudgetTransfer {
    return {
      transactionId: op.id,
      description: op.description,
      amount: op.amount,
      createdAt: op.createdAt.toISOString(),
      category,
    };
  }

  /** Transferencias enviadas en un mes, con su categoría (FR-013). */
  async function listTransfers(
    userId: string,
    query: { month?: string | undefined; cursor?: string | undefined; limit: number },
  ): Promise<BudgetTransfersPage> {
    const month = resolveMonth(query.month);
    const own = await accounts.ensureForUser(prisma, userId);
    const page = await ledger.pageCompletedTransactions(
      prisma,
      own.id,
      'transfer',
      monthRange(month),
      query,
    );
    const overrides = await repo.categoriesFor(
      prisma,
      page.items.map((t) => t.id),
    );
    return {
      items: page.items.map((op) => toTransfer(op, overrides.get(op.id) ?? 'transfers')),
      nextCursor: page.nextCursor,
    };
  }

  /** Reclasifica una transferencia enviada por la estudiante (FR-003, FR-012, FR-013). */
  async function setTransferCategory(
    userId: string,
    transactionId: string,
    category: BudgetCategory,
  ): Promise<BudgetTransfer> {
    const own = await accounts.ensureForUser(prisma, userId);
    const op = await ledger.findTransaction(prisma, transactionId);
    // Recibidas, ajenas, de otro tipo o no completadas: como si no existieran.
    if (!op || op.accountId !== own.id || op.type !== 'transfer' || op.status !== 'completed') {
      throw appError('NOT_FOUND');
    }
    await repo.upsertCategory(prisma, op.id, userId, category, clock.now());
    if (bogotaMonth(op.createdAt) === currentMonth()) await evaluateCurrentMonth(userId);
    return toTransfer(op, category);
  }

  return {
    monthSummary,
    setLimit: (userId: string, category: BudgetCategory, monthlyLimit: number) =>
      changeLimit(userId, category, monthlyLimit),
    removeLimit: (userId: string, category: BudgetCategory) => changeLimit(userId, category, null),
    evaluateCurrentMonth,
    listAlerts,
    markSeen,
    listTransfers,
    setTransferCategory,
  };
}

export type BudgetsService = ReturnType<typeof createBudgetsService>;
