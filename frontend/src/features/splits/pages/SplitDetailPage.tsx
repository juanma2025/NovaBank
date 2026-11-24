import { formatCOP } from '@nova/shared';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { APP_MESSAGES, SPLITS_MESSAGES } from '../../../lib/messages.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { BudgetAlertToast } from '../../budgets/components/BudgetAlertToast.tsx';
import { useTransferLimits } from '../../transfers/hooks/useTransferLimits.ts';
import { ConfirmActionDialog } from '../components/ConfirmActionDialog.tsx';
import { PayShareDialog } from '../components/PayShareDialog.tsx';
import { SplitHeaderCard } from '../components/SplitHeaderCard.tsx';
import { SplitShareRow } from '../components/SplitShareRow.tsx';
import {
  useCancelSplit,
  useDeclineShare,
  useMarkSharePaid,
  usePaySplitShare,
  useRemindShare,
  useSplitDetail,
} from '../hooks/useSplits.ts';

/** Página `/compartidos/:id`: detalle, pago de mi parte y gestión según rol (spec 007). */
export default function SplitDetailPage() {
  const { id = '' } = useParams();
  const splitQuery = useSplitDetail(id);
  const limitsQuery = useTransferLimits();
  const { hidden } = useBalanceVisibility();

  const payMutation = usePaySplitShare(id);
  const declineMutation = useDeclineShare(id);
  const markPaidMutation = useMarkSharePaid(id);
  const remindMutation = useRemindShare(id);
  const cancelMutation = useCancelSplit(id);

  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState<string | undefined>(undefined);
  const [payLocked, setPayLocked] = useState(false);
  const [serverRequiresReauth, setServerRequiresReauth] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  const [declineOpen, setDeclineOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  );

  const split = splitQuery.data;
  const myShare = split?.shares.find((share) => share.isMe) ?? null;
  const canPayOrDecline =
    split?.status === 'open' && split.role === 'participant' && myShare?.status === 'pending';
  const canManageAsCreator = split?.status === 'open' && split.role === 'creator';

  const reauthThreshold = limitsQuery.data?.reauthThreshold;
  const requiresReauth =
    serverRequiresReauth ||
    (myShare !== null && reauthThreshold !== undefined && myShare.amount > reauthThreshold);

  async function handleConfirmPay(password?: string): Promise<void> {
    if (payMutation.isPending) return;
    setPayError(undefined);
    try {
      await payMutation.mutateAsync(password !== undefined ? { password } : {});
      setPayOpen(false);
      setPayLocked(false);
      setServerRequiresReauth(false);
      setJustPaid(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setPayError(error.message);
        if (error.code === 'REAUTH_REQUIRED') setServerRequiresReauth(true);
        if (error.code === 'REAUTH_LOCKED') setPayLocked(true);
      }
    }
  }

  function handleMarkPaid(shareId: string): void {
    setFeedback(null);
    markPaidMutation.mutate(shareId, {
      onError: (err) => setFeedback({ kind: 'error', text: err.message }),
    });
  }

  function handleRemind(shareId: string, displayName: string): void {
    setFeedback(null);
    remindMutation.mutate(shareId, {
      onSuccess: () =>
        setFeedback({ kind: 'success', text: SPLITS_MESSAGES.reminderSentNotice(displayName) }),
      onError: (err) => setFeedback({ kind: 'error', text: err.message }),
    });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/compartidos"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{SPLITS_MESSAGES.backToSplits}</span>
        </Link>

        {justPaid && (
          <div className="space-y-3">
            <BudgetAlertToast active />
            <Alert variant="success">{SPLITS_MESSAGES.paySuccessNotice}</Alert>
          </div>
        )}

        {splitQuery.isError ? (
          <GlassCard className="space-y-3 p-6 text-center">
            {splitQuery.error.status === 404 ? (
              <>
                <h1 className="text-xl font-semibold text-text">{SPLITS_MESSAGES.notFoundTitle}</h1>
                <p className="text-sm text-text-secondary">{SPLITS_MESSAGES.notFoundDescription}</p>
              </>
            ) : (
              <Alert
                variant="error"
                action={
                  <Button variant="secondary" onClick={() => void splitQuery.refetch()}>
                    {APP_MESSAGES.retry}
                  </Button>
                }
              >
                {splitQuery.error.message || SPLITS_MESSAGES.loadError}
              </Alert>
            )}
          </GlassCard>
        ) : splitQuery.isPending || !split ? (
          <div
            className="nova-glass h-56 animate-pulse rounded-[var(--radius-xl)] bg-surface-subtle/60"
            aria-busy="true"
          />
        ) : (
          <>
            <SplitHeaderCard
              split={split}
              balanceHidden={hidden}
              canPayOrDecline={Boolean(canPayOrDecline)}
              canManageAsCreator={Boolean(canManageAsCreator)}
              onOpenPay={() => {
                setPayError(undefined);
                setPayLocked(false);
                payMutation.resetAttempt();
                setPayOpen(true);
              }}
              onOpenDecline={() => {
                declineMutation.reset();
                setDeclineOpen(true);
              }}
              onOpenCancel={() => {
                cancelMutation.reset();
                setCancelOpen(true);
              }}
            />

            {feedback && <Alert variant={feedback.kind}>{feedback.text}</Alert>}

            <GlassCard className="space-y-3">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
                {SPLITS_MESSAGES.detailParticipantsTitle}
              </h2>
              <ul className="divide-y divide-border">
                {split.shares.map((share) => (
                  <SplitShareRow
                    key={share.id}
                    share={share}
                    canManageAsCreator={Boolean(canManageAsCreator)}
                    balanceHidden={hidden}
                    isMarkingPaid={
                      markPaidMutation.isPending && markPaidMutation.variables === share.id
                    }
                    isReminding={remindMutation.isPending && remindMutation.variables === share.id}
                    onMarkPaid={handleMarkPaid}
                    onRemind={handleRemind}
                  />
                ))}
              </ul>
            </GlassCard>

            {myShare && (
              <PayShareDialog
                open={payOpen}
                splitTitle={split.title}
                creatorName={split.creatorName}
                amount={myShare.amount}
                requiresReauth={requiresReauth}
                reauthThreshold={reauthThreshold}
                isSubmitting={payMutation.isPending}
                error={payError}
                isLockedError={payLocked}
                onConfirm={(password) => {
                  void handleConfirmPay(password);
                }}
                onCancel={() => {
                  setPayOpen(false);
                  setPayError(undefined);
                  setPayLocked(false);
                  payMutation.resetAttempt();
                }}
              />
            )}

            <ConfirmActionDialog
              open={declineOpen && myShare !== null}
              title={SPLITS_MESSAGES.declineDialogTitle}
              description={SPLITS_MESSAGES.declineDialogBody(
                split.title,
                formatCOP(myShare?.amount ?? 0),
              )}
              confirmLabel={SPLITS_MESSAGES.declineDialogConfirm}
              loadingLabel={SPLITS_MESSAGES.decliningAction}
              isLoading={declineMutation.isPending}
              error={declineMutation.error?.message}
              onConfirm={() =>
                declineMutation.mutate(undefined, { onSuccess: () => setDeclineOpen(false) })
              }
              onCancel={() => setDeclineOpen(false)}
            />

            <ConfirmActionDialog
              open={cancelOpen}
              title={SPLITS_MESSAGES.cancelDialogTitle}
              description={SPLITS_MESSAGES.cancelDialogBody(split.title)}
              confirmLabel={SPLITS_MESSAGES.cancelDialogConfirm}
              loadingLabel={SPLITS_MESSAGES.cancelingSplitAction}
              isLoading={cancelMutation.isPending}
              error={cancelMutation.error?.message}
              onConfirm={() =>
                cancelMutation.mutate(undefined, { onSuccess: () => setCancelOpen(false) })
              }
              onCancel={() => setCancelOpen(false)}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
