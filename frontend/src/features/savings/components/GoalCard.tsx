import { bogotaToday, formatCOP, type Goal, goalProgress } from '@nova/shared';
import { Calendar, CheckCircle2, Clock, PiggyBank } from 'lucide-react';
import type { ReactNode } from 'react';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { SAVINGS_MESSAGES } from '../../../lib/messages.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';

export interface GoalCardProps {
  goal: Goal;
  balanceHidden?: boolean;
  today?: string;
  footer?: ReactNode;
}

/**
 * Tarjeta de meta de ahorro con barra de progreso y porcentaje explícito en texto (spec 005, T016).
 */
export function GoalCard({
  goal,
  balanceHidden = false,
  today = bogotaToday(new Date()),
  footer,
}: GoalCardProps) {
  const progress = goalProgress(goal, today);
  const isClosed = goal.status === 'closed';

  return (
    <GlassCard
      className={`flex h-full flex-col justify-between gap-4 p-5 ${isClosed ? 'opacity-70' : ''}`}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border ${
                progress.completed && !isClosed
                  ? 'border-success-border bg-success-bg text-success'
                  : 'border-border bg-brand-soft text-brand-text'
              }`}
            >
              {progress.completed && !isClosed ? (
                <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
              ) : (
                <PiggyBank aria-hidden="true" className="h-5 w-5" />
              )}
            </span>
            <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-text">
              {goal.name}
            </h2>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {isClosed ? (
              <span className="rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-text-muted">
                {SAVINGS_MESSAGES.closedBadge}
              </span>
            ) : progress.completed ? (
              <span className="rounded-[var(--radius-pill)] border border-success-border bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">
                {SAVINGS_MESSAGES.completedBadge}
              </span>
            ) : progress.overdue ? (
              <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-warning-border bg-warning-bg px-2.5 py-0.5 text-xs font-semibold text-warning">
                <Clock aria-hidden="true" className="h-3 w-3 shrink-0" />
                <span>{SAVINGS_MESSAGES.overdueBadge}</span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-text tabular-nums">
              {SAVINGS_MESSAGES.savedOfTarget(
                movementPresenter.formatBalance(goal.balance, balanceHidden),
                movementPresenter.formatBalance(goal.targetAmount, balanceHidden),
              )}
            </span>
            <span className="shrink-0 font-semibold text-brand-text tabular-nums">
              {progress.percent} %
            </span>
          </div>

          <div
            role="progressbar"
            aria-label={goal.name}
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-[var(--radius-pill)] bg-surface-subtle"
          >
            <div
              className={`h-full rounded-[var(--radius-pill)] transition-[width] duration-[var(--duration-medium)] ease-[var(--ease-smooth-out)] ${
                progress.completed ? 'bg-success' : 'bg-brand'
              }`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
            <span className="tabular-nums">
              {progress.completed
                ? SAVINGS_MESSAGES.goalAchievedLabel
                : SAVINGS_MESSAGES.remainingLabel(
                    movementPresenter.formatBalance(progress.remaining, balanceHidden),
                  )}
            </span>
            {progress.suggestedMonthly !== null && (
              <span className="font-medium text-brand-text tabular-nums">
                {SAVINGS_MESSAGES.suggestedMonthlyLabel(
                  balanceHidden ? '••••••' : formatCOP(progress.suggestedMonthly),
                )}
              </span>
            )}
          </div>
        </div>

        {goal.targetDate && (
          <p className="inline-flex items-center gap-1.5 text-xs text-text-muted tabular-nums">
            <Calendar aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>{SAVINGS_MESSAGES.targetDateLabel(goal.targetDate)}</span>
          </p>
        )}
      </div>

      {footer && <div className="border-t border-border pt-3.5">{footer}</div>}
    </GlassCard>
  );
}
