import type { Split } from '@nova/shared';
import { Ban, Send, XCircle } from 'lucide-react';

import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { SPLITS_MESSAGES } from '../../../lib/messages.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { SplitStatusBadge } from './SplitStatusBadge.tsx';

export interface SplitHeaderCardProps {
  split: Split;
  balanceHidden: boolean;
  canPayOrDecline: boolean;
  canManageAsCreator: boolean;
  onOpenPay: () => void;
  onOpenDecline: () => void;
  onOpenCancel: () => void;
}

/** Encabezado del detalle de una división con total, parte propia y acciones por rol. */
export function SplitHeaderCard({
  split,
  balanceHidden,
  canPayOrDecline,
  canManageAsCreator,
  onOpenPay,
  onOpenDecline,
  onOpenCancel,
}: SplitHeaderCardProps) {
  return (
    <GlassCard className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text">{split.title}</h1>
            <SplitStatusBadge status={split.status} />
          </div>
          <p className="text-xs text-text-muted tabular-nums">
            {movementPresenter.formatDateTime(split.createdAt)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-text-secondary">{SPLITS_MESSAGES.totalLabel}</p>
          <p className="text-2xl font-semibold text-text tabular-nums">
            {movementPresenter.formatBalance(split.totalAmount, balanceHidden)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-text-secondary">
          {split.role === 'creator'
            ? SPLITS_MESSAGES.yourOwnShareLabel
            : SPLITS_MESSAGES.creatorShareLabel(split.creatorName)}
        </span>
        <span className="font-semibold text-text tabular-nums">
          {movementPresenter.formatBalance(split.creatorShare, balanceHidden)}
        </span>
      </div>

      {canPayOrDecline && (
        <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-4">
          <Button type="button" onClick={onOpenPay}>
            <Send aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{SPLITS_MESSAGES.payMyShareAction}</span>
          </Button>
          <Button type="button" variant="secondary" onClick={onOpenDecline}>
            <Ban aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{SPLITS_MESSAGES.declineMyShareAction}</span>
          </Button>
        </div>
      )}

      {canManageAsCreator && (
        <div className="border-t border-border pt-4">
          <Button type="button" variant="danger" onClick={onOpenCancel}>
            <XCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{SPLITS_MESSAGES.cancelSplitAction}</span>
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
