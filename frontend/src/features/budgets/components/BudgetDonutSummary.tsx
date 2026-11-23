import {
  BUDGET_CATEGORY_LABELS,
  type BudgetCategory,
  type BudgetCategorySummary,
} from '@nova/shared';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { BUDGET_MESSAGES } from '../../../lib/messages.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';

export interface BudgetDonutSummaryProps {
  totalSpent: number;
  categories: readonly BudgetCategorySummary[];
  balanceHidden: boolean;
}

const CATEGORY_STROKE_COLORS: Record<BudgetCategory, string> = {
  food: 'var(--color-brand)',
  books: 'var(--color-brand-violet)',
  transport: 'var(--color-info)',
  stationery: 'var(--color-success)',
  entertainment: 'var(--color-warning)',
  transfers: 'var(--color-brand-text)',
  other: 'var(--color-text-muted)',
};

const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Resumen visual del mes con anillo SVG puro sin dependencias externas (spec 006). */
export function BudgetDonutSummary({
  totalSpent,
  categories,
  balanceHidden,
}: BudgetDonutSummaryProps) {
  const configuredCount = categories.filter((c) => c.limit !== null).length;
  const spentCategories = categories.filter((c) => c.spent > 0);

  let cumulativeOffset = 0;
  const segments =
    totalSpent > 0
      ? spentCategories.map((item) => {
          const fraction = item.spent / totalSpent;
          const length = fraction * CIRCUMFERENCE;
          const segment = {
            category: item.category,
            spent: item.spent,
            color: CATEGORY_STROKE_COLORS[item.category],
            dashArray: `${length} ${CIRCUMFERENCE - length}`,
            dashOffset: -cumulativeOffset,
          };
          cumulativeOffset += length;
          return segment;
        })
      : [];

  return (
    <GlassCard className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0" aria-hidden="true">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="var(--color-surface-subtle)"
              strokeWidth="12"
            />
            {segments.map((seg) => (
              <circle
                key={seg.category}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={seg.color}
                strokeWidth="12"
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.dashOffset}
                className="transition-[stroke-dasharray,stroke-dashoffset] duration-[var(--duration-medium)] ease-[var(--ease-smooth-out)]"
              />
            ))}
          </svg>
        </div>

        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-text-secondary">
            {BUDGET_MESSAGES.totalSpentLabel}
          </p>
          <p className="text-2xl font-semibold tracking-[-0.03em] text-text tabular-nums sm:text-3xl">
            {movementPresenter.formatBalance(totalSpent, balanceHidden)}
          </p>
          <p className="text-xs text-text-muted tabular-nums">
            {BUDGET_MESSAGES.configuredCount(configuredCount, categories.length)}
          </p>
        </div>
      </div>

      {segments.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-secondary sm:max-w-xs sm:justify-end">
          {segments.map((seg) => (
            <li key={seg.category} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              <span>{BUDGET_CATEGORY_LABELS[seg.category]}</span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
