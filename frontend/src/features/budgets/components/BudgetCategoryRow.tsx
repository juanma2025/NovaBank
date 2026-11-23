import {
  BUDGET_CATEGORY_LABELS,
  type BudgetCategory,
  type BudgetCategorySummary,
  type BudgetStatus,
} from '@nova/shared';
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Bus,
  CheckCircle2,
  Film,
  MinusCircle,
  OctagonAlert,
  PencilLine,
  Tag,
  Utensils,
} from 'lucide-react';

import { Button } from '../../../components/Button.tsx';
import { BUDGET_MESSAGES } from '../../../lib/messages.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';

export interface BudgetCategoryRowProps {
  item: BudgetCategorySummary;
  editable: boolean;
  balanceHidden: boolean;
  onEditLimit: (item: BudgetCategorySummary) => void;
}

function CategoryIcon({ category }: { category: BudgetCategory }) {
  const cls = 'h-[18px] w-[18px] shrink-0';
  switch (category) {
    case 'food':
      return <Utensils aria-hidden="true" className={cls} />;
    case 'books':
      return <BookOpen aria-hidden="true" className={cls} />;
    case 'transport':
      return <Bus aria-hidden="true" className={cls} />;
    case 'stationery':
      return <PencilLine aria-hidden="true" className={cls} />;
    case 'entertainment':
      return <Film aria-hidden="true" className={cls} />;
    case 'transfers':
      return <ArrowLeftRight aria-hidden="true" className={cls} />;
    case 'other':
      return <Tag aria-hidden="true" className={cls} />;
  }
}

function StatusBadge({ status }: { status: BudgetStatus }) {
  const label = BUDGET_MESSAGES.statusLabels[status];
  if (status === 'exceeded') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-danger-border bg-danger-bg px-2.5 py-0.5 text-xs font-semibold text-danger">
        <OctagonAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-warning-border bg-warning-bg px-2.5 py-0.5 text-xs font-semibold text-warning">
        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-success-border bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">
        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-2.5 py-0.5 text-xs font-medium text-text-muted">
      <MinusCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

/** Fila de categoría del presupuesto con barra, porcentaje y estado explícito en texto (spec 006). */
export function BudgetCategoryRow({
  item,
  editable,
  balanceHidden,
  onEditLimit,
}: BudgetCategoryRowProps) {
  const label = BUDGET_CATEGORY_LABELS[item.category];
  const formattedSpent = movementPresenter.formatBalance(item.spent, balanceHidden);
  const formattedLimit =
    item.limit !== null ? movementPresenter.formatBalance(item.limit, balanceHidden) : null;
  const barWidth = item.percent !== null ? Math.min(100, item.percent) : 0;
  const excess = item.limit !== null && item.spent > item.limit ? item.spent - item.limit : 0;
  const remaining = item.limit !== null && item.spent <= item.limit ? item.limit - item.spent : 0;

  const barColor =
    item.status === 'exceeded'
      ? 'bg-danger'
      : item.status === 'warning'
        ? 'bg-warning'
        : 'bg-brand';

  return (
    <li className="space-y-3 py-4 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-soft text-brand-text">
            <CategoryIcon category={item.category} />
          </span>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold text-text">{label}</h3>
              <StatusBadge status={item.status} />
            </div>
            <p className="text-xs text-text-secondary tabular-nums">
              {formattedLimit !== null
                ? BUDGET_MESSAGES.spentOfLimit(formattedSpent, formattedLimit)
                : formattedSpent}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {item.percent !== null && (
            <span
              className={`text-sm font-semibold tabular-nums ${
                item.status === 'exceeded'
                  ? 'text-danger'
                  : item.status === 'warning'
                    ? 'text-warning'
                    : 'text-brand-text'
              }`}
            >
              {item.percent} %
            </span>
          )}
          {editable && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onEditLimit(item)}
              aria-label={`${item.limit !== null ? BUDGET_MESSAGES.editLimitAction : BUDGET_MESSAGES.setLimitAction} en ${label}`}
            >
              {item.limit !== null
                ? BUDGET_MESSAGES.editLimitAction
                : BUDGET_MESSAGES.setLimitAction}
            </Button>
          )}
        </div>
      </div>

      {item.limit !== null && item.percent !== null && (
        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-label={label}
            aria-valuenow={item.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-[var(--radius-pill)] bg-surface-subtle"
          >
            <div
              className={`h-full rounded-[var(--radius-pill)] transition-[width] duration-[var(--duration-medium)] ease-[var(--ease-smooth-out)] ${barColor}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="text-xs text-text-muted tabular-nums">
            {excess > 0
              ? BUDGET_MESSAGES.exceededByLabel(
                  movementPresenter.formatBalance(excess, balanceHidden),
                )
              : BUDGET_MESSAGES.remainingBudgetLabel(
                  movementPresenter.formatBalance(remaining, balanceHidden),
                )}
          </p>
        </div>
      )}
    </li>
  );
}
