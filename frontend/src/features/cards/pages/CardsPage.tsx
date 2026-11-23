import { MAX_ACTIVE_CARDS } from '@nova/shared';
import { ArrowRight, CreditCard, Plus, ShoppingBag, Snowflake, Unlock } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { APP_MESSAGES, CARDS_MESSAGES } from '../../../lib/messages.ts';
import { CardNicknameDialog } from '../components/CardNicknameDialog.tsx';
import { VirtualCard } from '../components/VirtualCard.tsx';
import { useCards, useIssueCard, useSetCardFrozen } from '../hooks/useCards.ts';

export default function CardsPage() {
  const cardsQuery = useCards();
  const issueCard = useIssueCard();
  const setFrozen = useSetCardFrozen();

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [togglingCardId, setTogglingCardId] = useState<string | null>(null);

  const rawCards = cardsQuery.data?.items ?? [];
  // Vigentes primero (activas/congeladas), canceladas al final (spec 004, T033).
  const sortedCards = [...rawCards].sort((a, b) => {
    const aCanceled = a.status === 'canceled' ? 1 : 0;
    const bCanceled = b.status === 'canceled' ? 1 : 0;
    return aCanceled - bCanceled;
  });

  const activeCount = rawCards.filter((card) => card.status !== 'canceled').length;
  const maxReached = activeCount >= MAX_ACTIVE_CARDS;

  async function handleIssue(nickname: string): Promise<void> {
    setCreateError(undefined);
    try {
      await issueCard.mutateAsync(nickname);
      setCreateOpen(false);
    } catch (error) {
      if (error instanceof ApiError) setCreateError(error.message);
    }
  }

  async function handleToggleFrozen(cardId: string, freeze: boolean): Promise<void> {
    setActionError(undefined);
    setTogglingCardId(cardId);
    try {
      await setFrozen.mutateAsync({ cardId, freeze });
    } catch (error) {
      if (error instanceof ApiError) setActionError(error.message);
    } finally {
      setTogglingCardId(null);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 lg:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
              {CARDS_MESSAGES.pageTitle}
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              {CARDS_MESSAGES.pageSubtitle}
            </p>
            {cardsQuery.data && (
              <p className="text-xs font-medium text-text-muted tabular-nums">
                {CARDS_MESSAGES.activeCountLabel(activeCount, MAX_ACTIVE_CARDS)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/tienda"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface/90 px-4 py-2 text-sm font-semibold text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle"
            >
              <ShoppingBag aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{CARDS_MESSAGES.goToStore}</span>
            </Link>

            <Button
              type="button"
              onClick={() => {
                setCreateError(undefined);
                setCreateOpen(true);
              }}
            >
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{CARDS_MESSAGES.newCardAction}</span>
            </Button>
          </div>
        </div>

        {maxReached && <Alert variant="info">{CARDS_MESSAGES.maxReachedNotice}</Alert>}
        {actionError && <Alert variant="error">{actionError}</Alert>}

        {cardsQuery.isError ? (
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button
                  variant="secondary"
                  loading={cardsQuery.isFetching}
                  onClick={() => void cardsQuery.refetch()}
                >
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {cardsQuery.error.message || CARDS_MESSAGES.loadError}
            </Alert>
          </GlassCard>
        ) : cardsQuery.isPending ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[1, 2].map((item) => (
              <GlassCard key={item} className="h-52 animate-pulse bg-surface-subtle/50">
                <span className="sr-only">{APP_MESSAGES.loadingPage}</span>
              </GlassCard>
            ))}
          </div>
        ) : sortedCards.length === 0 ? (
          <GlassCard className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-brand-soft text-brand-text">
              <CreditCard aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="max-w-sm space-y-1">
              <h2 className="text-lg font-semibold text-text">{CARDS_MESSAGES.emptyTitle}</h2>
              <p className="text-sm text-text-secondary">{CARDS_MESSAGES.emptyDescription}</p>
            </div>
            <Button
              type="button"
              onClick={() => {
                setCreateError(undefined);
                setCreateOpen(true);
              }}
            >
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{CARDS_MESSAGES.emptyAction}</span>
            </Button>
          </GlassCard>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {sortedCards.map((card) => {
              const isCanceled = card.status === 'canceled';
              const isFrozen = card.status === 'frozen';
              const isToggling = togglingCardId === card.id;

              return (
                <GlassCard
                  key={card.id}
                  className={`flex flex-col justify-between gap-4 p-4 sm:p-5 ${
                    isCanceled ? 'opacity-70' : ''
                  }`}
                >
                  <VirtualCard card={card} />

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
                    {!isCanceled && (
                      <Button
                        type="button"
                        variant="secondary"
                        loading={isToggling}
                        loadingLabel={
                          isFrozen ? CARDS_MESSAGES.unfreezingAction : CARDS_MESSAGES.freezingAction
                        }
                        onClick={() => void handleToggleFrozen(card.id, !isFrozen)}
                      >
                        {isFrozen ? (
                          <Unlock aria-hidden="true" className="h-4 w-4 shrink-0" />
                        ) : (
                          <Snowflake aria-hidden="true" className="h-4 w-4 shrink-0" />
                        )}
                        <span>
                          {isFrozen ? CARDS_MESSAGES.unfreezeAction : CARDS_MESSAGES.freezeAction}
                        </span>
                      </Button>
                    )}

                    <Link
                      to={`/tarjetas/${card.id}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-brand-text transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
                    >
                      <span>{CARDS_MESSAGES.viewDetail}</span>
                      <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                    </Link>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}

        <CardNicknameDialog
          open={createOpen}
          mode="create"
          isSubmitting={issueCard.isPending}
          serverError={createError}
          onSubmit={(nickname) => void handleIssue(nickname)}
          onCancel={() => {
            setCreateOpen(false);
            setCreateError(undefined);
          }}
        />
      </div>
    </AppShell>
  );
}
