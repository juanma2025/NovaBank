import { AlertTriangle, ArrowRight, OctagonAlert } from 'lucide-react';
import { Link } from 'react-router';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { BUDGET_MESSAGES } from '../../../lib/messages.ts';
import { useBudgetMonth } from '../../budgets/hooks/useBudgets.ts';

/**
 * Aviso informativo en `/inicio` con las categorías del mes en alerta (80 % o > 100 %).
 * Oculto automáticamente si no hay categorías en alerta o si aún no hay presupuesto (spec 006, T020).
 */
export function BudgetAlertBanner() {
  const budgetQuery = useBudgetMonth();
  const flagged =
    budgetQuery.data?.categories.filter(
      (cat) => cat.status === 'warning' || cat.status === 'exceeded',
    ) ?? [];

  if (flagged.length === 0) return null;

  const hasExceeded = flagged.some((cat) => cat.status === 'exceeded');

  return (
    <GlassCard
      className={`flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
        hasExceeded
          ? 'border-danger-border bg-danger-bg/60'
          : 'border-warning-border bg-warning-bg/60'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${
            hasExceeded ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'
          }`}
        >
          {hasExceeded ? (
            <OctagonAlert aria-hidden="true" className="h-5 w-5" />
          ) : (
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          )}
        </span>

        <div className="min-w-0 space-y-1">
          <h2 className="text-sm font-semibold text-text">{BUDGET_MESSAGES.bannerTitle}</h2>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-text-secondary tabular-nums">
            {flagged.map((cat) => (
              <li key={cat.category}>
                {cat.status === 'exceeded'
                  ? BUDGET_MESSAGES.bannerExceededItem(cat.category, cat.percent ?? 100)
                  : BUDGET_MESSAGES.bannerWarningItem(cat.category, cat.percent ?? 80)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Link
        to="/presupuesto"
        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[var(--radius-md)] px-2 text-sm font-semibold text-brand-text transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
      >
        <span>{BUDGET_MESSAGES.bannerLink}</span>
        <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
      </Link>
    </GlassCard>
  );
}
