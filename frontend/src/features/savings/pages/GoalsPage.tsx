import { type Goal, MAX_ACTIVE_GOALS } from '@nova/shared';
import { ArrowLeft, ArrowRight, PiggyBank, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { APP_MESSAGES, SAVINGS_MESSAGES } from '../../../lib/messages.ts';
import { useAccount } from '../../accounts/hooks/useAccount.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { GoalCard } from '../components/GoalCard.tsx';
import { GoalFormDialog, type GoalFormValues } from '../components/GoalFormDialog.tsx';
import { SavingsAmountDialog } from '../components/SavingsAmountDialog.tsx';
import { useCreateGoal, useDeposit, useGoals, useSavingsLimits } from '../hooks/useSavings.ts';

function QuickDepositModal({
  goal,
  availableBalance,
  balanceHidden,
  onClose,
}: {
  goal: Goal;
  availableBalance: number;
  balanceHidden: boolean;
  onClose: () => void;
}) {
  const limitsQuery = useSavingsLimits();
  const depositMutation = useDeposit(goal.id);

  function handleConfirm(amount: number): void {
    depositMutation.mutate(amount, {
      onSuccess: () => onClose(),
    });
  }

  function handleCancel(): void {
    depositMutation.reset();
    depositMutation.resetAttempt();
    onClose();
  }

  return (
    <SavingsAmountDialog
      open
      mode="deposit"
      availableAmount={availableBalance}
      balanceHidden={balanceHidden}
      limits={limitsQuery.data}
      isSubmitting={depositMutation.isPending}
      serverError={depositMutation.error?.message}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}

/** Página `/metas`: lista de metas activas y cerradas con total ahorrado (spec 005, T017/T025). */
export default function GoalsPage() {
  const goalsQuery = useGoals();
  const accountQuery = useAccount();
  const createMutation = useCreateGoal();
  const { hidden } = useBalanceVisibility();

  const [createOpen, setCreateOpen] = useState(false);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);

  const goals = goalsQuery.data?.items ?? [];
  const totalSaved = goalsQuery.data?.totalSaved ?? 0;
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const closedGoals = goals.filter((goal) => goal.status === 'closed');
  const orderedGoals = [...activeGoals, ...closedGoals];
  const atLimit = activeGoals.length >= MAX_ACTIVE_GOALS;

  function handleCreate(values: GoalFormValues): void {
    createMutation.mutate(
      {
        name: values.name,
        targetAmount: values.targetAmount,
        ...(values.targetDate ? { targetDate: values.targetDate } : {}),
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          createMutation.reset();
        },
      },
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Link
              to="/inicio"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{SAVINGS_MESSAGES.backToHome}</span>
            </Link>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
              {SAVINGS_MESSAGES.pageTitle}
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              {SAVINGS_MESSAGES.pageSubtitle}
            </p>
          </div>

          <Button
            type="button"
            onClick={() => {
              createMutation.reset();
              setCreateOpen(true);
            }}
          >
            <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{SAVINGS_MESSAGES.newGoalAction}</span>
          </Button>
        </div>

        <GlassCard className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-text-secondary">
              {SAVINGS_MESSAGES.totalSavedLabel}
            </p>
            <p className="text-2xl font-semibold tracking-[-0.03em] text-text tabular-nums sm:text-3xl">
              {movementPresenter.formatBalance(totalSaved, hidden)}
            </p>
          </div>

          <span className="rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-3 py-1 text-xs font-semibold text-text-secondary tabular-nums">
            {SAVINGS_MESSAGES.activeCountLabel(activeGoals.length, MAX_ACTIVE_GOALS)}
          </span>
        </GlassCard>

        {atLimit && <Alert variant="info">{SAVINGS_MESSAGES.maxReachedNotice}</Alert>}

        {goalsQuery.isError ? (
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button
                  variant="secondary"
                  loading={goalsQuery.isFetching}
                  onClick={() => {
                    void goalsQuery.refetch();
                  }}
                >
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {goalsQuery.error.message || SAVINGS_MESSAGES.loadError}
            </Alert>
          </GlassCard>
        ) : goalsQuery.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="nova-glass h-48 animate-pulse rounded-[var(--radius-xl)] bg-surface-subtle/60"
              />
            ))}
          </div>
        ) : orderedGoals.length === 0 ? (
          <GlassCard className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-brand-soft text-brand-text">
              <PiggyBank aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="max-w-md space-y-1.5">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
                {SAVINGS_MESSAGES.emptyTitle}
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                {SAVINGS_MESSAGES.emptyDescription}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => {
                createMutation.reset();
                setCreateOpen(true);
              }}
            >
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{SAVINGS_MESSAGES.emptyAction}</span>
            </Button>
          </GlassCard>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {orderedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                balanceHidden={hidden}
                footer={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {goal.status === 'active' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setDepositGoal(goal)}
                      >
                        {SAVINGS_MESSAGES.depositAction}
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Link
                      to={`/metas/${goal.id}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-md)] px-2 text-sm font-semibold text-brand-text transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
                    >
                      <span>{SAVINGS_MESSAGES.viewDetail}</span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                    </Link>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </div>

      <GoalFormDialog
        open={createOpen}
        mode="create"
        isSubmitting={createMutation.isPending}
        serverError={createMutation.error?.message}
        onSubmit={handleCreate}
        onCancel={() => {
          createMutation.reset();
          setCreateOpen(false);
        }}
      />

      {depositGoal && (
        <QuickDepositModal
          goal={depositGoal}
          availableBalance={accountQuery.data?.balance ?? 0}
          balanceHidden={hidden}
          onClose={() => setDepositGoal(null)}
        />
      )}
    </AppShell>
  );
}
