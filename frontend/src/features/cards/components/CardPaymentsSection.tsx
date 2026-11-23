import { formatCOP } from '@nova/shared';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { SoftSwapText } from '../../../components/SoftSwapText.tsx';
import {
  APP_MESSAGES,
  CARDS_MESSAGES,
  HOME_MESSAGES,
  MERCHANT_CATEGORY_LABELS,
} from '../../../lib/messages.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { useCardPayments } from '../hooks/useCards.ts';

export interface CardPaymentsSectionProps {
  cardId: string;
  balanceHidden: boolean;
}

export function CardPaymentsSection({ cardId, balanceHidden }: CardPaymentsSectionProps) {
  const paymentsQuery = useCardPayments(cardId);
  const payments = paymentsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <GlassCard className="space-y-4">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
        {CARDS_MESSAGES.paymentsSectionTitle}
      </h2>

      {paymentsQuery.isError ? (
        <Alert
          variant="error"
          action={
            <Button variant="secondary" onClick={() => void paymentsQuery.refetch()}>
              {APP_MESSAGES.retry}
            </Button>
          }
        >
          {paymentsQuery.error.message || CARDS_MESSAGES.paymentsError}
        </Alert>
      ) : paymentsQuery.isPending ? (
        <div className="h-20 animate-pulse rounded-[var(--radius-md)] bg-surface-subtle/50" />
      ) : payments.length === 0 ? (
        <p className="text-sm text-text-secondary">{CARDS_MESSAGES.paymentsEmpty}</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-1 last:pb-1"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-[15px] font-medium text-text">
                    {payment.merchantName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <span>{MERCHANT_CATEGORY_LABELS[payment.category]}</span>
                    <time dateTime={payment.createdAt} className="tabular-nums">
                      {movementPresenter.formatDateTime(payment.createdAt)}
                    </time>
                  </div>
                </div>

                <SoftSwapText
                  text={balanceHidden ? '••••••' : `-${formatCOP(payment.amount)}`}
                  align="end"
                  ariaLabel={balanceHidden ? HOME_MESSAGES.amountHiddenSr : undefined}
                  className={`shrink-0 text-[15px] font-semibold tabular-nums ${
                    balanceHidden ? 'text-text-muted' : 'text-danger'
                  }`}
                />
              </li>
            ))}
          </ul>

          {paymentsQuery.hasNextPage && (
            <div className="flex justify-center border-t border-border pt-4">
              <Button
                type="button"
                variant="secondary"
                loading={paymentsQuery.isFetchingNextPage}
                loadingLabel={CARDS_MESSAGES.paymentsLoadingMore}
                onClick={() => void paymentsQuery.fetchNextPage()}
              >
                {CARDS_MESSAGES.paymentsLoadMore}
              </Button>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}
