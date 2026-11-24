import { ArrowLeft, ArrowRight, Plus, Users } from 'lucide-react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { APP_MESSAGES, SPLITS_MESSAGES } from '../../../lib/messages.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { ShareStatusBadge, SplitStatusBadge } from '../components/SplitStatusBadge.tsx';
import { useSplitsList, useSplitsSummary } from '../hooks/useSplits.ts';

/** Página `/compartidos`: divisiones creadas y en las que participa, paginadas (spec 007, T020). */
export default function SplitsPage() {
  const listQuery = useSplitsList();
  const summaryQuery = useSplitsSummary();
  const { hidden } = useBalanceVisibility();

  const items = listQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const summary = summaryQuery.data;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Link
              to="/inicio"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{SPLITS_MESSAGES.backToHome}</span>
            </Link>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
              {SPLITS_MESSAGES.pageTitle}
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              {SPLITS_MESSAGES.pageSubtitle}
            </p>
          </div>

          <Link
            to="/compartidos/nueva"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand px-4 py-2.5 text-[15px] font-semibold tracking-[-0.01em] text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-brand-hover active:bg-brand-active"
          >
            <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{SPLITS_MESSAGES.newSplitAction}</span>
          </Link>
        </div>

        {summary && (summary.toCollect.amount > 0 || summary.toPay.amount > 0) && (
          <GlassCard className="grid grid-cols-2 gap-4 p-5">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-text-secondary">
                {SPLITS_MESSAGES.toCollectLabel}
              </p>
              <p className="text-xl font-semibold text-success tabular-nums sm:text-2xl">
                {movementPresenter.formatBalance(summary.toCollect.amount, hidden)}
              </p>
              <p className="text-xs text-text-muted">
                {SPLITS_MESSAGES.pendingSharesCount(summary.toCollect.count)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-text-secondary">
                {SPLITS_MESSAGES.toPayLabel}
              </p>
              <p className="text-xl font-semibold text-danger tabular-nums sm:text-2xl">
                {movementPresenter.formatBalance(summary.toPay.amount, hidden)}
              </p>
              <p className="text-xs text-text-muted">
                {SPLITS_MESSAGES.pendingSharesCount(summary.toPay.count)}
              </p>
            </div>
          </GlassCard>
        )}

        {listQuery.isError ? (
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button
                  variant="secondary"
                  loading={listQuery.isFetching}
                  onClick={() => {
                    void listQuery.refetch();
                  }}
                >
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {listQuery.error.message || SPLITS_MESSAGES.loadError}
            </Alert>
          </GlassCard>
        ) : listQuery.isPending ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="nova-glass h-28 animate-pulse rounded-[var(--radius-xl)] bg-surface-subtle/60"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <GlassCard className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-brand-soft text-brand-text">
              <Users aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="max-w-md space-y-1.5">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
                {SPLITS_MESSAGES.emptyTitle}
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary">
                {SPLITS_MESSAGES.emptyDescription}
              </p>
            </div>
            <Link
              to="/compartidos/nueva"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand px-4 py-2.5 text-[15px] font-semibold text-on-brand shadow-[var(--shadow-control)] hover:bg-brand-hover"
            >
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{SPLITS_MESSAGES.emptyAction}</span>
            </Link>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id}>
                  <GlassCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-text">{item.title}</h2>
                        <SplitStatusBadge status={item.status} />
                        <span className="rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                          {SPLITS_MESSAGES.roleLabels[item.role]}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary tabular-nums">
                        <span>
                          {SPLITS_MESSAGES.totalLabel}:{' '}
                          <strong className="font-semibold text-text">
                            {movementPresenter.formatBalance(item.totalAmount, hidden)}
                          </strong>
                        </span>
                        {item.role === 'creator' && item.pendingCount > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {SPLITS_MESSAGES.pendingSummaryLabel(
                                item.pendingCount,
                                movementPresenter.formatBalance(item.pendingAmount, hidden),
                              )}
                            </span>
                          </>
                        )}
                        {item.myShare && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {SPLITS_MESSAGES.mySharePendingLabel(
                                movementPresenter.formatBalance(item.myShare.amount, hidden),
                              )}
                            </span>
                            <ShareStatusBadge status={item.myShare.status} />
                          </>
                        )}
                      </div>
                    </div>

                    <Link
                      to={`/compartidos/${item.id}`}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[var(--radius-md)] px-2 text-sm font-semibold text-brand-text transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
                    >
                      <span>{SPLITS_MESSAGES.viewDetail}</span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                    </Link>
                  </GlassCard>
                </li>
              ))}
            </ul>

            {listQuery.hasNextPage && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  loading={listQuery.isFetchingNextPage}
                  loadingLabel={SPLITS_MESSAGES.loadingMore}
                  onClick={() => {
                    void listQuery.fetchNextPage();
                  }}
                >
                  {SPLITS_MESSAGES.loadMore}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
