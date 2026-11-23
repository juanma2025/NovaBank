import { ArrowRight, Users } from 'lucide-react';
import { Link } from 'react-router';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { SPLITS_MESSAGES } from '../../../lib/messages.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { useSplitsSummary } from '../../splits/hooks/useSplits.ts';

/**
 * Resumen en `/inicio` de cuánto te deben y cuánto debes en divisiones abiertas (spec 007, T020).
 * Oculta automáticamente cuando ambos montos son 0.
 */
export function SplitsSummaryCard() {
  const summaryQuery = useSplitsSummary();
  const { hidden } = useBalanceVisibility();

  const summary = summaryQuery.data;
  if (!summary || (summary.toCollect.amount === 0 && summary.toPay.amount === 0)) {
    return null;
  }

  return (
    <GlassCard className="space-y-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-soft text-brand-text">
            <Users aria-hidden="true" className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold tracking-[-0.02em] text-text">
            {SPLITS_MESSAGES.summaryTitle}
          </h2>
        </div>

        <Link
          to="/compartidos"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-brand-text transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
        >
          <span>{SPLITS_MESSAGES.summaryLink}</span>
          <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div className="space-y-0.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 p-3">
          <p className="text-xs font-medium text-text-secondary">
            {SPLITS_MESSAGES.toCollectLabel}
          </p>
          <p className="text-lg font-semibold text-success tabular-nums">
            {movementPresenter.formatBalance(summary.toCollect.amount, hidden)}
          </p>
          <p className="text-xs text-text-muted">
            {SPLITS_MESSAGES.pendingSharesCount(summary.toCollect.count)}
          </p>
        </div>

        <div className="space-y-0.5 rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 p-3">
          <p className="text-xs font-medium text-text-secondary">{SPLITS_MESSAGES.toPayLabel}</p>
          <p className="text-lg font-semibold text-danger tabular-nums">
            {movementPresenter.formatBalance(summary.toPay.amount, hidden)}
          </p>
          <p className="text-xs text-text-muted">
            {SPLITS_MESSAGES.pendingSharesCount(summary.toPay.count)}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
