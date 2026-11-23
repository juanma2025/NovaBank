import { type CardPaymentResult, formatCOP, maskCardNumber } from '@nova/shared';
import { Link } from 'react-router';

import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { SuccessCheck } from '../../../components/SuccessCheck.tsx';
import { STORE_MESSAGES } from '../../../lib/messages.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';

export interface StoreSuccessViewProps {
  result: CardPaymentResult;
  merchantName: string;
  balanceHidden: boolean;
  onStartAnother: () => void;
}

export function StoreSuccessView({
  result,
  merchantName,
  balanceHidden,
  onStartAnother,
}: StoreSuccessViewProps) {
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="t-toast is-open flex items-center gap-3 rounded-[var(--radius-md)] border border-success-border bg-success-bg px-4 py-3 text-sm font-medium text-success"
      >
        <SuccessCheck className="h-[18px] w-[18px] shrink-0" />
        <span>
          {STORE_MESSAGES.successToast(formatCOP(Math.abs(result.movement.amount)), merchantName)}
        </span>
      </div>

      <GlassCard className="t-surface-enter space-y-6">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-success-border bg-success-bg text-success">
            <SuccessCheck className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-text">
              {STORE_MESSAGES.successTitle}
            </h2>
            <p className="text-sm text-text-secondary">
              {result.movement.description} ·{' '}
              <span className="font-semibold text-danger tabular-nums">
                {formatCOP(result.movement.amount)}
              </span>
            </p>
          </div>
        </div>

        <dl className="divide-y divide-border border-t border-border text-sm">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-text-secondary">{STORE_MESSAGES.successCardUsedLabel}</dt>
            <dd className="font-semibold text-text tabular-nums">
              {maskCardNumber(result.cardLast4)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3 last:pb-0">
            <dt className="text-text-secondary">{STORE_MESSAGES.successNewBalanceLabel}</dt>
            <dd className="text-xl font-semibold text-text tabular-nums">
              {movementPresenter.formatBalance(result.balance, balanceHidden)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2.5 border-t border-border pt-4 sm:flex-row">
          <Link
            to="/inicio"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] bg-brand px-4 py-2.5 text-[15px] font-semibold text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-brand-hover"
          >
            {STORE_MESSAGES.successGoHome}
          </Link>
          <Button variant="secondary" fullWidth onClick={onStartAnother}>
            {STORE_MESSAGES.successAnother}
          </Button>
        </div>
      </GlassCard>
    </>
  );
}
