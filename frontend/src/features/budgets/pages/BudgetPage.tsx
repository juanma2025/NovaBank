import {
  addMonths,
  bogotaMonth,
  BUDGET_HISTORY_MONTHS,
  type BudgetCategory,
  type BudgetCategorySummary,
} from '@nova/shared';
import { ArrowLeft, Calendar, Plus } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { APP_MESSAGES, BUDGET_MESSAGES } from '../../../lib/messages.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { BudgetCategoryRow } from '../components/BudgetCategoryRow.tsx';
import { BudgetDonutSummary } from '../components/BudgetDonutSummary.tsx';
import { BudgetLimitDialog } from '../components/BudgetLimitDialog.tsx';
import { BudgetTransfersSection } from '../components/BudgetTransfersSection.tsx';
import { useBudgetMonth, useRemoveBudgetLimit, useSetBudgetLimit } from '../hooks/useBudgets.ts';

const monthLabelFormatter = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatMonthLabel(month: string, isCurrent: boolean): string {
  const [yearPart, monthPart] = month.split('-');
  const date = new Date(Date.UTC(Number(yearPart), Number(monthPart) - 1, 15));
  const raw = monthLabelFormatter.format(date);
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
  return isCurrent ? `${capitalized} · ${BUDGET_MESSAGES.currentMonthTag}` : capitalized;
}

/** Página `/presupuesto`: topes mensuales, progreso por categoría, historial 6 meses y reclasificación. */
export default function BudgetPage() {
  const currentMonth = useMemo(() => bogotaMonth(new Date()), []);
  const monthOptions = useMemo(
    () =>
      Array.from({ length: BUDGET_HISTORY_MONTHS + 1 }, (_, index) =>
        addMonths(currentMonth, -index),
      ),
    [currentMonth],
  );

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [editingTarget, setEditingTarget] = useState<{
    category: BudgetCategory;
    limit: number | null;
  } | null>(null);

  const monthSelectId = useId();
  const { hidden } = useBalanceVisibility();
  const isCurrentMonth = selectedMonth === currentMonth;

  const budgetQuery = useBudgetMonth(selectedMonth);
  const setLimitMutation = useSetBudgetLimit();
  const removeLimitMutation = useRemoveBudgetLimit();

  const budget = budgetQuery.data;
  const isEmptyInitial =
    Boolean(budget) &&
    budget?.totalSpent === 0 &&
    budget.categories.every((cat) => cat.limit === null);

  function openDialog(item: BudgetCategorySummary): void {
    setLimitMutation.reset();
    removeLimitMutation.reset();
    setEditingTarget({ category: item.category, limit: item.limit });
  }

  function handleSaveLimit(category: BudgetCategory, monthlyLimit: number): void {
    setLimitMutation.mutate(
      { category, monthlyLimit },
      {
        onSuccess: () => {
          setEditingTarget(null);
          setLimitMutation.reset();
        },
      },
    );
  }

  function handleRemoveLimit(category: BudgetCategory): void {
    removeLimitMutation.mutate(category, {
      onSuccess: () => {
        setEditingTarget(null);
        removeLimitMutation.reset();
      },
    });
  }

  const dialogError = setLimitMutation.error?.message ?? removeLimitMutation.error?.message;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Link
              to="/inicio"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{BUDGET_MESSAGES.backToHome}</span>
            </Link>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
              {BUDGET_MESSAGES.pageTitle}
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              {BUDGET_MESSAGES.pageSubtitle}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={monthSelectId}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary"
            >
              <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{BUDGET_MESSAGES.monthSelectorLabel}</span>
            </label>
            <select
              id={monthSelectId}
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="min-h-11 cursor-pointer rounded-[var(--radius-md)] border border-border-strong bg-surface px-3.5 py-2 text-sm font-medium text-text shadow-[var(--shadow-control)]"
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month, month === currentMonth)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Alert variant="info">
          {isCurrentMonth ? BUDGET_MESSAGES.infoNotice : BUDGET_MESSAGES.pastMonthNotice}
        </Alert>

        {budgetQuery.isError ? (
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button
                  variant="secondary"
                  loading={budgetQuery.isFetching}
                  onClick={() => {
                    void budgetQuery.refetch();
                  }}
                >
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {budgetQuery.error.message || BUDGET_MESSAGES.loadError}
            </Alert>
          </GlassCard>
        ) : budgetQuery.isPending || !budget ? (
          <div className="space-y-4" aria-busy="true">
            <div className="nova-glass h-36 animate-pulse rounded-[var(--radius-xl)] bg-surface-subtle/60" />
            <div className="nova-glass h-72 animate-pulse rounded-[var(--radius-xl)] bg-surface-subtle/60" />
          </div>
        ) : (
          <>
            <BudgetDonutSummary
              totalSpent={budget.totalSpent}
              categories={budget.categories}
              balanceHidden={hidden}
            />

            {isCurrentMonth && isEmptyInitial && (
              <GlassCard className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-text">
                    {BUDGET_MESSAGES.emptyPromptTitle}
                  </h2>
                  <p className="text-sm text-text-secondary">{BUDGET_MESSAGES.emptyPromptBody}</p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setLimitMutation.reset();
                    removeLimitMutation.reset();
                    setEditingTarget({ category: 'food', limit: null });
                  }}
                >
                  <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span>{BUDGET_MESSAGES.emptyPromptAction}</span>
                </Button>
              </GlassCard>
            )}

            <GlassCard className="space-y-3">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
                {BUDGET_MESSAGES.categoriesTitle}
              </h2>
              <ul className="divide-y divide-border">
                {budget.categories.map((cat) => (
                  <BudgetCategoryRow
                    key={cat.category}
                    item={cat}
                    editable={isCurrentMonth}
                    balanceHidden={hidden}
                    onEditLimit={openDialog}
                  />
                ))}
              </ul>
            </GlassCard>

            <BudgetTransfersSection month={selectedMonth} balanceHidden={hidden} />
          </>
        )}
      </div>

      <BudgetLimitDialog
        open={editingTarget !== null}
        category={editingTarget?.category ?? null}
        currentLimit={editingTarget?.limit ?? null}
        isSaving={setLimitMutation.isPending}
        isRemoving={removeLimitMutation.isPending}
        serverError={dialogError}
        onSave={handleSaveLimit}
        onRemove={handleRemoveLimit}
        onCancel={() => {
          setLimitMutation.reset();
          removeLimitMutation.reset();
          setEditingTarget(null);
        }}
      />
    </AppShell>
  );
}
