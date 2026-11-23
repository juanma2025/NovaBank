import type { SplitShare } from '@nova/shared';
import { Bell, Check } from 'lucide-react';

import { Button } from '../../../components/Button.tsx';
import { SPLITS_MESSAGES } from '../../../lib/messages.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { ShareStatusBadge } from './SplitStatusBadge.tsx';

export interface SplitShareRowProps {
  share: SplitShare;
  canManageAsCreator: boolean;
  balanceHidden: boolean;
  isMarkingPaid: boolean;
  isReminding: boolean;
  onMarkPaid: (shareId: string) => void;
  onRemind: (shareId: string, displayName: string) => void;
}

/** Fila de participante en `/compartidos/:id` con acciones del creador si está pendiente. */
export function SplitShareRow({
  share,
  canManageAsCreator,
  balanceHidden,
  isMarkingPaid,
  isReminding,
  onMarkPaid,
  onRemind,
}: SplitShareRowProps) {
  const showCreatorActions = canManageAsCreator && share.status === 'pending';

  return (
    <li className="space-y-3 py-3.5 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium text-text">{share.displayName}</span>
            {share.isMe && (
              <span className="rounded-[var(--radius-pill)] border border-border bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-text">
                {SPLITS_MESSAGES.meBadge}
              </span>
            )}
            <ShareStatusBadge status={share.status} />
          </div>
          {share.resolvedAt && (
            <p className="text-xs text-text-muted tabular-nums">
              {movementPresenter.formatDateTime(share.resolvedAt)}
            </p>
          )}
        </div>

        <span className="text-base font-semibold text-text tabular-nums">
          {movementPresenter.formatBalance(share.amount, balanceHidden)}
        </span>
      </div>

      {showCreatorActions && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            loading={isMarkingPaid}
            loadingLabel={SPLITS_MESSAGES.markingPaidOutside}
            disabled={isReminding}
            onClick={() => onMarkPaid(share.id)}
          >
            <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{SPLITS_MESSAGES.markPaidOutsideAction}</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            loading={isReminding}
            loadingLabel={SPLITS_MESSAGES.remindingAction}
            disabled={isMarkingPaid}
            onClick={() => onRemind(share.id, share.displayName)}
          >
            <Bell aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{SPLITS_MESSAGES.remindAction}</span>
          </Button>
        </div>
      )}
    </li>
  );
}
