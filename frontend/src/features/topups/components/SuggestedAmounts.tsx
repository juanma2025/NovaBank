import { formatCOP, SUGGESTED_TOPUP_AMOUNTS, type TopupLimits } from '@nova/shared';

import { TOPUP_MESSAGES } from '../../../lib/messages.ts';

export interface SuggestedAmountsProps {
  selectedAmount: number | null;
  limits?: TopupLimits;
  disabled?: boolean;
  onSelect: (amount: number) => void;
}

export function SuggestedAmounts({
  selectedAmount,
  limits,
  disabled = false,
  onSelect,
}: SuggestedAmountsProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-muted">{TOPUP_MESSAGES.suggestedLabel}</p>
      <div className="grid grid-cols-3 gap-2">
        {SUGGESTED_TOPUP_AMOUNTS.map((amount) => {
          const isSelected = selectedAmount === amount;
          const outOfLimits = Boolean(
            limits &&
            (amount < limits.minAmount ||
              amount > limits.maxAmount ||
              amount > limits.remainingToday),
          );
          const isDisabled = disabled || outOfLimits;

          return (
            <button
              key={amount}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              onClick={() => onSelect(amount)}
              className={`min-h-11 cursor-pointer rounded-[var(--radius-md)] border px-2 py-2 text-sm font-semibold tabular-nums transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] disabled:cursor-not-allowed disabled:opacity-45 ${
                isSelected
                  ? 'border-brand bg-brand-soft text-brand-text'
                  : 'border-border-strong bg-surface text-text hover:bg-surface-subtle'
              }`}
            >
              {formatCOP(amount)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
