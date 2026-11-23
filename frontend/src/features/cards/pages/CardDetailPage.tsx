import { ArrowLeft, Eye, Pencil, Snowflake, Trash2, Unlock } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { APP_MESSAGES, CARDS_MESSAGES } from '../../../lib/messages.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { CardNicknameDialog } from '../components/CardNicknameDialog.tsx';
import { CardPaymentsSection } from '../components/CardPaymentsSection.tsx';
import { RevealCardDialog } from '../components/RevealCardDialog.tsx';
import { VirtualCard } from '../components/VirtualCard.tsx';
import { useCancelCard, useCards, useRenameCard, useSetCardFrozen } from '../hooks/useCards.ts';

export default function CardDetailPage() {
  const { id = '' } = useParams();
  const cardsQuery = useCards();
  const renameCard = useRenameCard();
  const setFrozen = useSetCardFrozen();
  const cancelCard = useCancelCard();
  const { hidden: balanceHidden } = useBalanceVisibility();

  const [revealOpen, setRevealOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameError, setRenameError] = useState<string | undefined>(undefined);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>(undefined);

  const cancelTitleId = useId();
  const cancelDescId = useId();

  const card = cardsQuery.data?.items.find((item) => item.id === id) ?? null;

  async function handleRename(nickname: string): Promise<void> {
    if (!card) return;
    setRenameError(undefined);
    try {
      await renameCard.mutateAsync({ cardId: card.id, nickname });
      setRenameOpen(false);
    } catch (error) {
      if (error instanceof ApiError) setRenameError(error.message);
    }
  }

  async function handleToggleFrozen(): Promise<void> {
    if (!card) return;
    setActionError(undefined);
    try {
      await setFrozen.mutateAsync({ cardId: card.id, freeze: card.status !== 'frozen' });
    } catch (error) {
      if (error instanceof ApiError) setActionError(error.message);
    }
  }

  async function handleConfirmCancel(): Promise<void> {
    if (!card) return;
    setActionError(undefined);
    try {
      await cancelCard.mutateAsync(card.id);
      setCancelOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setCancelOpen(false);
        setActionError(error.message);
      }
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Link
          to="/tarjetas"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{CARDS_MESSAGES.backToCards}</span>
        </Link>

        {cardsQuery.isPending ? (
          <GlassCard className="h-52 animate-pulse bg-surface-subtle/50">
            <span className="sr-only">{APP_MESSAGES.loadingPage}</span>
          </GlassCard>
        ) : cardsQuery.isError ? (
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button variant="secondary" onClick={() => void cardsQuery.refetch()}>
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {cardsQuery.error.message || CARDS_MESSAGES.loadError}
            </Alert>
          </GlassCard>
        ) : !card ? (
          <GlassCard className="space-y-3 text-center">
            <h1 className="text-xl font-semibold text-text">{CARDS_MESSAGES.notFoundTitle}</h1>
            <p className="text-sm text-text-secondary">{CARDS_MESSAGES.notFoundDescription}</p>
          </GlassCard>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text">{card.nickname}</h1>

            {actionError && <Alert variant="error">{actionError}</Alert>}

            <GlassCard className="space-y-5">
              <VirtualCard card={card} />

              {card.status === 'canceled' ? (
                <Alert variant="info">{CARDS_MESSAGES.canceledReadOnlyNotice}</Alert>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-4 sm:flex sm:flex-wrap">
                  <Button type="button" onClick={() => setRevealOpen(true)}>
                    <Eye aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>{CARDS_MESSAGES.revealAction}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    loading={setFrozen.isPending}
                    onClick={() => void handleToggleFrozen()}
                  >
                    {card.status === 'frozen' ? (
                      <Unlock aria-hidden="true" className="h-4 w-4 shrink-0" />
                    ) : (
                      <Snowflake aria-hidden="true" className="h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {card.status === 'frozen'
                        ? CARDS_MESSAGES.unfreezeAction
                        : CARDS_MESSAGES.freezeAction}
                    </span>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setRenameError(undefined);
                      setRenameOpen(true);
                    }}
                  >
                    <Pencil aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>{CARDS_MESSAGES.renameAction}</span>
                  </Button>

                  <Button type="button" variant="danger" onClick={() => setCancelOpen(true)}>
                    <Trash2 aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span>{CARDS_MESSAGES.cancelAction}</span>
                  </Button>
                </div>
              )}
            </GlassCard>

            <CardPaymentsSection cardId={card.id} balanceHidden={balanceHidden} />

            {card.status !== 'canceled' && (
              <>
                <RevealCardDialog
                  open={revealOpen}
                  cardId={card.id}
                  onClose={() => setRevealOpen(false)}
                />

                <CardNicknameDialog
                  open={renameOpen}
                  mode="rename"
                  initialNickname={card.nickname}
                  isSubmitting={renameCard.isPending}
                  serverError={renameError}
                  onSubmit={(nickname) => void handleRename(nickname)}
                  onCancel={() => {
                    setRenameOpen(false);
                    setRenameError(undefined);
                  }}
                />

                <ModalDialog
                  open={cancelOpen}
                  titleId={cancelTitleId}
                  descriptionId={cancelDescId}
                  maxWidthClass="max-w-sm"
                  preventClose={cancelCard.isPending}
                  onClose={() => setCancelOpen(false)}
                >
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <h2
                        id={cancelTitleId}
                        className="text-lg font-semibold tracking-[-0.02em] text-text"
                      >
                        {CARDS_MESSAGES.cancelDialogTitle}
                      </h2>
                      <p id={cancelDescId} className="text-sm leading-relaxed text-text-secondary">
                        {CARDS_MESSAGES.cancelDialogBody(card.nickname, card.last4)}
                      </p>
                    </div>

                    <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row">
                      <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        disabled={cancelCard.isPending}
                        onClick={() => setCancelOpen(false)}
                      >
                        {CARDS_MESSAGES.dialogCancel}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        fullWidth
                        loading={cancelCard.isPending}
                        loadingLabel={CARDS_MESSAGES.cancelingAction}
                        onClick={() => void handleConfirmCancel()}
                      >
                        {CARDS_MESSAGES.cancelDialogConfirm}
                      </Button>
                    </div>
                  </div>
                </ModalDialog>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
