import { BUDGET_CATEGORIES, BUDGET_CATEGORY_LABELS, type BudgetCategory } from '@nova/shared';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { APP_MESSAGES, BUDGET_MESSAGES } from '../../../lib/messages.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { useBudgetTransfers, useSetTransferCategory } from '../hooks/useBudgets.ts';

export interface BudgetTransfersSectionProps {
  month: string;
  balanceHidden: boolean;
}

/** Lista de transferencias enviadas en el mes con selector para reclasificarlas (spec 006, T024). */
export function BudgetTransfersSection({ month, balanceHidden }: BudgetTransfersSectionProps) {
  const transfersQuery = useBudgetTransfers(month);
  const reclassifyMutation = useSetTransferCategory();
  const items = transfersQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <GlassCard className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
          {BUDGET_MESSAGES.transfersTitle}
        </h2>
        <p className="text-sm text-text-secondary">{BUDGET_MESSAGES.transfersSubtitle}</p>
      </div>

      {reclassifyMutation.error && (
        <Alert variant="error">{reclassifyMutation.error.message}</Alert>
      )}

      {transfersQuery.isError ? (
        <Alert
          variant="error"
          action={
            <Button
              variant="secondary"
              loading={transfersQuery.isFetching}
              onClick={() => {
                void transfersQuery.refetch();
              }}
            >
              {APP_MESSAGES.retry}
            </Button>
          }
        >
          {transfersQuery.error.message || BUDGET_MESSAGES.transfersError}
        </Alert>
      ) : transfersQuery.isPending ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2].map((row) => (
            <div
              key={row}
              className="h-14 animate-pulse rounded-[var(--radius-md)] bg-surface-subtle/70"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-3 text-sm text-text-secondary">{BUDGET_MESSAGES.transfersEmpty}</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {items.map((transfer) => {
              const isUpdatingThis =
                reclassifyMutation.isPending &&
                reclassifyMutation.variables?.transactionId === transfer.transactionId;
              return (
                <li
                  key={transfer.transactionId}
                  className="flex flex-col gap-3 py-3.5 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-[15px] font-medium text-text">
                      {transfer.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted tabular-nums">
                      <time dateTime={transfer.createdAt}>
                        {movementPresenter.formatDateTime(transfer.createdAt)}
                      </time>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-danger">
                        {movementPresenter.formatSignedAmount(-transfer.amount, balanceHidden)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <select
                      aria-label={BUDGET_MESSAGES.categorySelectLabel(transfer.description)}
                      value={transfer.category}
                      disabled={isUpdatingThis}
                      onChange={(event) => {
                        const nextCategory = event.target.value as BudgetCategory;
                        reclassifyMutation.mutate({
                          transactionId: transfer.transactionId,
                          category: nextCategory,
                        });
                      }}
                      className="min-h-11 w-full cursor-pointer rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle disabled:opacity-60 sm:w-auto"
                    >
                      {BUDGET_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {BUDGET_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              );
            })}
          </ul>

          {transfersQuery.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="secondary"
                loading={transfersQuery.isFetchingNextPage}
                loadingLabel={BUDGET_MESSAGES.transfersLoadingMore}
                onClick={() => {
                  void transfersQuery.fetchNextPage();
                }}
              >
                {BUDGET_MESSAGES.transfersLoadMore}
              </Button>
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}
