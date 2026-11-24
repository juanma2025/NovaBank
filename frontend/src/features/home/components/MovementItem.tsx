import type { LedgerTransactionStatus, Movement, MovementType } from '@nova/shared';
import { ArrowDownLeft, ArrowLeftRight, CreditCard, PiggyBank } from 'lucide-react';

import { SoftSwapText } from '../../../components/SoftSwapText.tsx';
import { HOME_MESSAGES, MOVEMENT_MESSAGES } from '../../../lib/messages.ts';
import { MovementPresenter } from '../../accounts/services/movement-presenter.ts';

export interface MovementItemProps {
  movement: Movement;
  hideAmount?: boolean;
}

const presenter = new MovementPresenter({
  statusLabels: MOVEMENT_MESSAGES.statusLabels,
  typeLabels: MOVEMENT_MESSAGES.typeLabels,
});

const STATUS_BADGE_CLASSES: Record<Exclude<LedgerTransactionStatus, 'completed'>, string> = {
  pending: 'border-warning-border bg-warning-bg text-warning',
  failed: 'border-danger-border bg-danger-bg text-danger',
  reversed: 'border-info-border bg-info-bg text-info',
};

function MovementTypeIcon({ type }: { type: MovementType }) {
  if (type === 'transfer') {
    return <ArrowLeftRight aria-hidden="true" className="h-[18px] w-[18px]" />;
  }
  if (type === 'card_payment') {
    return <CreditCard aria-hidden="true" className="h-[18px] w-[18px]" />;
  }
  if (type === 'savings_deposit' || type === 'savings_withdrawal') {
    return <PiggyBank aria-hidden="true" className="h-[18px] w-[18px]" />;
  }
  return <ArrowDownLeft aria-hidden="true" className="h-[18px] w-[18px]" />;
}

export function MovementItem({ movement, hideAmount = false }: MovementItemProps) {
  const item = presenter.present(movement, hideAmount);
  const isCredit = item.direction === 'credit';

  return (
    <li className="flex items-start justify-between gap-3 py-3.5 first:pt-1 last:pb-1">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border ${
            isCredit
              ? 'border-success-border bg-success-bg text-success'
              : 'border-border bg-surface-subtle text-text-secondary'
          }`}
        >
          <MovementTypeIcon type={item.type} />
        </span>

        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-[15px] font-medium text-text">{item.description}</p>
          {item.note && <p className="truncate text-sm text-text-secondary">{item.note}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <time dateTime={movement.createdAt} className="text-xs text-text-muted tabular-nums">
              {item.formattedDate}
            </time>
            {item.status !== 'completed' && item.statusLabel && (
              <span
                className={`inline-flex items-center rounded-[var(--radius-pill)] border px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASSES[item.status]}`}
              >
                {item.statusLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 pt-0.5 text-right">
        <SoftSwapText
          text={item.formattedAmount}
          align="end"
          ariaLabel={hideAmount ? HOME_MESSAGES.amountHiddenSr : undefined}
          className={`text-[15px] font-semibold tabular-nums ${
            hideAmount ? 'text-text-muted' : isCredit ? 'text-success' : 'text-danger'
          }`}
        />
      </div>
    </li>
  );
}
