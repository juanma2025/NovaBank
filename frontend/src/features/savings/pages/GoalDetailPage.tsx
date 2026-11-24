import type { Goal } from '@nova/shared';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Pencil, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { APP_MESSAGES, SAVINGS_MESSAGES } from '../../../lib/messages.ts';
import { useAccount } from '../../accounts/hooks/useAccount.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { CloseGoalDialog } from '../components/CloseGoalDialog.tsx';
import { GoalCard } from '../components/GoalCard.tsx';
import { GoalFormDialog, type GoalFormValues } from '../components/GoalFormDialog.tsx';
import { GoalMovementsSection } from '../components/GoalMovementsSection.tsx';
import { SavingsAmountDialog } from '../components/SavingsAmountDialog.tsx';
import {
  useCloseGoal,
  useDeposit,
  useGoals,
  useSavingsLimits,
  useUpdateGoal,
  useWithdraw,
} from '../hooks/useSavings.ts';

function buildUpdatePayload(goal: Goal, values: GoalFormValues) {
  const payload: { name?: string; targetAmount?: number; targetDate?: string | null } = {};
  if (values.name !== goal.name) payload.name = values.name;
  if (values.targetAmount !== goal.targetAmount) payload.targetAmount = values.targetAmount;
  if (values.targetDate !== goal.targetDate) payload.targetDate = values.targetDate;
  return payload;
}

/** Página `/metas/:id`: progreso, aportar, retirar, editar, cerrar e historial (spec 005). */
export default function GoalDetailPage() {
  const { id = '' } = useParams();
  const goalsQuery = useGoals();
  const accountQuery = useAccount();
  const limitsQuery = useSavingsLimits();
  const { hidden } = useBalanceVisibility();

  const depositMutation = useDeposit(id);
  const withdrawMutation = useWithdraw(id);
  const updateMutation = useUpdateGoal(id);
  const closeMutation = useCloseGoal(id);

  const [amountMode, setAmountMode] = useState<'deposit' | 'withdraw' | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const goal = goalsQuery.data?.items.find((item) => item.id === id) ?? null;
  const isActive = goal?.status === 'active';

  function handleAmountConfirm(amount: number): void {
    if (amountMode === 'deposit') {
      depositMutation.mutate(amount, {
        onSuccess: () => setAmountMode(null),
      });
    } else if (amountMode === 'withdraw') {
      withdrawMutation.mutate(amount, {
        onSuccess: () => setAmountMode(null),
      });
    }
  }

  function handleAmountCancel(): void {
    depositMutation.reset();
    depositMutation.resetAttempt();
    withdrawMutation.reset();
    withdrawMutation.resetAttempt();
    setAmountMode(null);
  }

  function handleEditSubmit(values: GoalFormValues): void {
    if (!goal) return;
    const payload = buildUpdatePayload(goal, values);
    if (Object.keys(payload).length === 0) {
      setEditOpen(false);
      return;
    }
    updateMutation.mutate(payload, {
      onSuccess: () => {
        setEditOpen(false);
        updateMutation.reset();
      },
    });
  }

  function handleCloseConfirm(): void {
    closeMutation.mutate(undefined, {
      onSuccess: () => {
        setCloseOpen(false);
        closeMutation.reset();
      },
    });
  }

  const activeAmountMutation = amountMode === 'withdraw' ? withdrawMutation : depositMutation;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/metas"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{SAVINGS_MESSAGES.backToGoals}</span>
        </Link>

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
          <div
            className="nova-glass h-52 animate-pulse rounded-[var(--radius-xl)] bg-surface-subtle/60"
            aria-busy="true"
          />
        ) : !goal ? (
          <GlassCard className="space-y-3 p-6 text-center">
            <h1 className="text-xl font-semibold tracking-[-0.025em] text-text">
              {SAVINGS_MESSAGES.notFoundTitle}
            </h1>
            <p className="text-sm text-text-secondary">{SAVINGS_MESSAGES.notFoundDescription}</p>
            <div className="pt-2">
              <Link
                to="/metas"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-brand px-4 py-2 text-sm font-semibold text-on-brand"
              >
                {SAVINGS_MESSAGES.backToGoals}
              </Link>
            </div>
          </GlassCard>
        ) : (
          <>
            <h1 className="sr-only">{goal.name}</h1>

            <GoalCard
              goal={goal}
              balanceHidden={hidden}
              footer={
                isActive ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      type="button"
                      onClick={() => {
                        depositMutation.reset();
                        depositMutation.resetAttempt();
                        setAmountMode('deposit');
                      }}
                    >
                      <ArrowDownLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>{SAVINGS_MESSAGES.depositAction}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        withdrawMutation.reset();
                        withdrawMutation.resetAttempt();
                        setAmountMode('withdraw');
                      }}
                    >
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>{SAVINGS_MESSAGES.withdrawAction}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        updateMutation.reset();
                        setEditOpen(true);
                      }}
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>{SAVINGS_MESSAGES.editAction}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        closeMutation.reset();
                        closeMutation.resetAttempt();
                        setCloseOpen(true);
                      }}
                    >
                      <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>{SAVINGS_MESSAGES.closeAction}</span>
                    </Button>
                  </div>
                ) : (
                  <Alert variant="info">{SAVINGS_MESSAGES.closedReadOnlyNotice}</Alert>
                )
              }
            />

            <GoalMovementsSection goalId={goal.id} hideAmounts={hidden} />

            {isActive && (
              <>
                <SavingsAmountDialog
                  open={amountMode !== null}
                  mode={amountMode ?? 'deposit'}
                  availableAmount={
                    amountMode === 'withdraw' ? goal.balance : (accountQuery.data?.balance ?? 0)
                  }
                  balanceHidden={hidden}
                  limits={limitsQuery.data}
                  isSubmitting={activeAmountMutation.isPending}
                  serverError={activeAmountMutation.error?.message}
                  onConfirm={handleAmountConfirm}
                  onCancel={handleAmountCancel}
                />

                <GoalFormDialog
                  open={editOpen}
                  mode="edit"
                  initialValues={{
                    name: goal.name,
                    targetAmount: goal.targetAmount,
                    targetDate: goal.targetDate,
                  }}
                  isSubmitting={updateMutation.isPending}
                  serverError={updateMutation.error?.message}
                  onSubmit={handleEditSubmit}
                  onCancel={() => {
                    updateMutation.reset();
                    setEditOpen(false);
                  }}
                />

                <CloseGoalDialog
                  open={closeOpen}
                  goalName={goal.name}
                  goalBalance={goal.balance}
                  isClosing={closeMutation.isPending}
                  serverError={closeMutation.error?.message}
                  onConfirm={handleCloseConfirm}
                  onCancel={() => {
                    closeMutation.reset();
                    closeMutation.resetAttempt();
                    setCloseOpen(false);
                  }}
                />
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
