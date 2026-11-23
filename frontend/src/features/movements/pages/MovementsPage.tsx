import { ArrowLeft, Eye, EyeOff, PlusCircle } from 'lucide-react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { APP_MESSAGES, HOME_MESSAGES, MOVEMENT_MESSAGES } from '../../../lib/messages.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { useMovements } from '../../accounts/hooks/useMovements.ts';
import { EmptyMovements } from '../../home/components/EmptyMovements.tsx';
import { MovementList } from '../../home/components/MovementList.tsx';

function MovementsSkeleton() {
  return (
    <GlassCard className="space-y-4">
      <div className="divide-y divide-border">
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex items-center justify-between gap-3 py-3.5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-[var(--radius-md)] bg-surface-subtle" />
              <div className="space-y-2">
                <div className="h-4 w-40 rounded-[var(--radius-sm)] bg-surface-subtle" />
                <div className="h-3 w-28 rounded-[var(--radius-sm)] bg-surface-subtle" />
              </div>
            </div>
            <div className="h-4 w-20 rounded-[var(--radius-sm)] bg-surface-subtle" />
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

export default function MovementsPage() {
  const movementsQuery = useMovements();
  const { hidden, toggle } = useBalanceVisibility();

  const movements = movementsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const hasLoadedData = movementsQuery.data !== undefined;
  const isInitialError = movementsQuery.isError && !hasLoadedData;
  const isRevealed = !movementsQuery.isPending && hasLoadedData;
  const visibilityLabel = hidden ? HOME_MESSAGES.showBalance : HOME_MESSAGES.hideBalance;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="space-y-3">
          <Link
            to="/inicio"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{MOVEMENT_MESSAGES.backToHome}</span>
          </Link>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
                {MOVEMENT_MESSAGES.pageTitle}
              </h1>
              <p className="text-sm leading-relaxed text-text-secondary">
                {MOVEMENT_MESSAGES.pageSubtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={hidden}
                onClick={toggle}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface/85 px-3.5 text-sm font-medium text-text-secondary shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-surface-subtle hover:text-text"
              >
                {hidden ? (
                  <Eye aria-hidden="true" className="h-4 w-4 shrink-0" />
                ) : (
                  <EyeOff aria-hidden="true" className="h-4 w-4 shrink-0" />
                )}
                <span>{visibilityLabel}</span>
              </button>

              <Link
                to="/recargar"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-brand-hover active:bg-brand-active"
              >
                <PlusCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>{HOME_MESSAGES.topupAction}</span>
              </Link>
            </div>
          </div>
        </div>

        {isInitialError ? (
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button
                  variant="secondary"
                  loading={movementsQuery.isFetching}
                  onClick={() => {
                    void movementsQuery.refetch();
                  }}
                >
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {movementsQuery.error.message || MOVEMENT_MESSAGES.loadError}
            </Alert>
          </GlassCard>
        ) : (
          <div className={`t-skel ${isRevealed ? 'is-revealed' : ''}`}>
            <div
              aria-hidden={isRevealed || undefined}
              aria-busy={!isRevealed || undefined}
              className="t-skel-skeleton"
            >
              <MovementsSkeleton />
            </div>

            <div aria-hidden={!isRevealed || undefined} className="t-skel-content">
              {hasLoadedData && (
                <GlassCard className="space-y-5">
                  {movements.length === 0 ? (
                    <EmptyMovements />
                  ) : (
                    <>
                      <MovementList movements={movements} hideAmounts={hidden} />

                      {movementsQuery.isFetchNextPageError && (
                        <div className="border-t border-border pt-4">
                          <Alert
                            variant="error"
                            action={
                              <Button
                                variant="secondary"
                                loading={movementsQuery.isFetchingNextPage}
                                onClick={() => {
                                  void movementsQuery.fetchNextPage();
                                }}
                              >
                                {APP_MESSAGES.retry}
                              </Button>
                            }
                          >
                            {movementsQuery.error.message || MOVEMENT_MESSAGES.loadError}
                          </Alert>
                        </div>
                      )}

                      {movementsQuery.hasNextPage && !movementsQuery.isFetchNextPageError && (
                        <div className="flex justify-center border-t border-border pt-4">
                          <Button
                            variant="secondary"
                            loading={movementsQuery.isFetchingNextPage}
                            loadingLabel={MOVEMENT_MESSAGES.loadingMore}
                            onClick={() => {
                              void movementsQuery.fetchNextPage();
                            }}
                          >
                            {MOVEMENT_MESSAGES.loadMore}
                          </Button>
                        </div>
                      )}

                      {!movementsQuery.hasNextPage && (
                        <p className="border-t border-border pt-4 text-center text-xs text-text-muted">
                          {MOVEMENT_MESSAGES.endOfHistory}
                        </p>
                      )}
                    </>
                  )}
                </GlassCard>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
