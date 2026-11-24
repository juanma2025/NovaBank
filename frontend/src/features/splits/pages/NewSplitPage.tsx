import {
  formatCOP,
  type RecipientPreview,
  SPLIT_TITLE_MAX_LENGTH,
  SPLIT_TOTAL_MAX,
  SPLIT_TOTAL_MIN,
  splitEvenly,
} from '@nova/shared';
import { ArrowLeft } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { SPLITS_MESSAGES } from '../../../lib/messages.ts';
import { AmountInput, formatCOPDigits } from '../../topups/components/AmountInput.tsx';
import { useTransferLimits } from '../../transfers/hooks/useTransferLimits.ts';
import { ParticipantAdder } from '../components/ParticipantAdder.tsx';
import { type ParticipantEntry, SplitSharesEditor } from '../components/SplitSharesEditor.tsx';
import { useCreateSplit } from '../hooks/useSplits.ts';

/** Página `/compartidos/nueva`: crear división con partes iguales editables y suma visible. */
export default function NewSplitPage() {
  const navigate = useNavigate();
  const limitsQuery = useTransferLimits();
  const createMutation = useCreateSplit();

  const [title, setTitle] = useState('');
  const [rawTotal, setRawTotal] = useState('');
  const [parsedTotal, setParsedTotal] = useState<number | null>(null);
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [rawCreatorShare, setRawCreatorShare] = useState('');
  const [creatorShare, setCreatorShare] = useState<number>(0);
  const [manualEdits, setManualEdits] = useState(false);

  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const [totalError, setTotalError] = useState<string | undefined>(undefined);
  const [sharesError, setSharesError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);

  function applyEvenSplit(total: number | null, list: ParticipantEntry[]): void {
    if (total === null || total <= 0 || list.length === 0) return;
    const { creatorShare: nextCreator, share } = splitEvenly(total, list.length);
    setCreatorShare(nextCreator);
    setRawCreatorShare(formatCOPDigits(nextCreator));
    setParticipants(
      list.map((entry) => ({
        ...entry,
        amount: share,
        rawAmount: formatCOPDigits(share),
      })),
    );
  }

  function handleTotalChange(parsed: number | null, formatted: string): void {
    setParsedTotal(parsed);
    setRawTotal(formatted);
    setTotalError(undefined);
    setSharesError(undefined);
    if (!manualEdits && parsed !== null && participants.length > 0) {
      applyEvenSplit(parsed, participants);
    }
  }

  function handleAddParticipant(recipient: RecipientPreview): void {
    const nextList: ParticipantEntry[] = [
      ...participants,
      { recipient, rawAmount: '', amount: null },
    ];
    setParticipants(nextList);
    setSharesError(undefined);
    if (!manualEdits && parsedTotal !== null) {
      applyEvenSplit(parsedTotal, nextList);
    }
  }

  function handleRemoveParticipant(recipientId: string): void {
    const nextList = participants.filter((entry) => entry.recipient.recipientId !== recipientId);
    setParticipants(nextList);
    setSharesError(undefined);
    if (!manualEdits && parsedTotal !== null && nextList.length > 0) {
      applyEvenSplit(parsedTotal, nextList);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (createMutation.isPending) return;

    const trimmedTitle = title.trim();
    let hasError = false;

    if (trimmedTitle.length === 0) {
      setTitleError(SPLITS_MESSAGES.validationTitleRequired);
      hasError = true;
    } else if (trimmedTitle.length > SPLIT_TITLE_MAX_LENGTH) {
      setTitleError(SPLITS_MESSAGES.validationTitleTooLong(SPLIT_TITLE_MAX_LENGTH));
      hasError = true;
    } else {
      setTitleError(undefined);
    }

    if (rawTotal.trim() === '' || parsedTotal === null) {
      setTotalError(SPLITS_MESSAGES.validationTotalRequired);
      hasError = true;
    } else if (parsedTotal < SPLIT_TOTAL_MIN || parsedTotal > SPLIT_TOTAL_MAX) {
      setTotalError(
        SPLITS_MESSAGES.validationTotalRange(
          formatCOP(SPLIT_TOTAL_MIN),
          formatCOP(SPLIT_TOTAL_MAX),
        ),
      );
      hasError = true;
    } else {
      setTotalError(undefined);
    }

    const participantsSum = participants.reduce((acc, item) => acc + (item.amount ?? 0), 0);
    const currentSum = creatorShare + participantsSum;
    let nextSharesError: string | undefined;

    if (participants.length === 0) {
      nextSharesError = SPLITS_MESSAGES.noParticipantsError;
    } else if (creatorShare < 0) {
      nextSharesError = SPLITS_MESSAGES.validationCreatorShareNegative;
    } else {
      const limits = limitsQuery.data;
      for (const entry of participants) {
        if (entry.amount === null || entry.amount <= 0) {
          nextSharesError = SPLITS_MESSAGES.sumMismatchLabel(
            formatCOP(currentSum),
            formatCOP(parsedTotal ?? 0),
          );
          break;
        }
        if (limits && (entry.amount < limits.minAmount || entry.amount > limits.maxAmount)) {
          nextSharesError = SPLITS_MESSAGES.validationShareRange(
            entry.recipient.displayName,
            formatCOP(limits.minAmount),
            formatCOP(limits.maxAmount),
          );
          break;
        }
      }
      if (!nextSharesError && parsedTotal !== null && currentSum !== parsedTotal) {
        nextSharesError = SPLITS_MESSAGES.sumMismatchLabel(
          formatCOP(currentSum),
          formatCOP(parsedTotal),
        );
      }
    }

    setSharesError(nextSharesError);
    if (hasError || nextSharesError || parsedTotal === null) {
      setShakeKey((prev) => prev + 1);
      return;
    }

    createMutation.mutate(
      {
        title: trimmedTitle,
        totalAmount: parsedTotal,
        creatorShare,
        shares: participants.map((entry) => ({
          recipientId: entry.recipient.recipientId,
          amount: entry.amount ?? 0,
        })),
      },
      {
        onSuccess: (created) => {
          void navigate(`/compartidos/${created.id}`, { replace: true });
        },
      },
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-2">
          <Link
            to="/compartidos"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{SPLITS_MESSAGES.backToSplits}</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
            {SPLITS_MESSAGES.newPageTitle}
          </h1>
          <p className="text-sm leading-relaxed text-text-secondary">
            {SPLITS_MESSAGES.newPageSubtitle}
          </p>
        </div>

        <Alert variant="info">{SPLITS_MESSAGES.noMoneyMovedNotice}</Alert>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <GlassCard className="space-y-4">
            <TextField
              label={SPLITS_MESSAGES.titleLabel}
              name="splitTitle"
              placeholder={SPLITS_MESSAGES.titlePlaceholder}
              maxLength={SPLIT_TITLE_MAX_LENGTH}
              value={title}
              disabled={createMutation.isPending}
              error={titleError}
              shakeKey={shakeKey}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleError(undefined);
              }}
            />

            <AmountInput
              label={SPLITS_MESSAGES.totalInputLabel}
              placeholder={SPLITS_MESSAGES.totalPlaceholder}
              value={rawTotal}
              disabled={createMutation.isPending}
              error={totalError}
              shakeKey={shakeKey}
              hint={SPLITS_MESSAGES.totalHint(
                formatCOP(SPLIT_TOTAL_MIN),
                formatCOP(SPLIT_TOTAL_MAX),
              )}
              onValueChange={handleTotalChange}
            />
          </GlassCard>

          <GlassCard className="space-y-4">
            <h2 className="text-base font-semibold tracking-[-0.02em] text-text">
              {SPLITS_MESSAGES.participantsTitle}
            </h2>

            <ParticipantAdder
              existingIds={participants.map((p) => p.recipient.recipientId)}
              disabled={createMutation.isPending}
              onAdd={handleAddParticipant}
            />

            {participants.length > 0 && (
              <SplitSharesEditor
                parsedTotal={parsedTotal}
                rawCreatorShare={rawCreatorShare}
                creatorShare={creatorShare}
                participants={participants}
                disabled={createMutation.isPending}
                onResetEven={() => {
                  setManualEdits(false);
                  applyEvenSplit(parsedTotal, participants);
                  setSharesError(undefined);
                }}
                onCreatorShareChange={(parsed, formatted) => {
                  setManualEdits(true);
                  setCreatorShare(parsed ?? 0);
                  setRawCreatorShare(formatted);
                  setSharesError(undefined);
                }}
                onParticipantShareChange={(recipientId, parsed, formatted) => {
                  setManualEdits(true);
                  setSharesError(undefined);
                  setParticipants((prev) =>
                    prev.map((item) =>
                      item.recipient.recipientId === recipientId
                        ? { ...item, amount: parsed, rawAmount: formatted }
                        : item,
                    ),
                  );
                }}
                onRemoveParticipant={handleRemoveParticipant}
              />
            )}

            {sharesError && <Alert variant="error">{sharesError}</Alert>}
            {createMutation.error && <Alert variant="error">{createMutation.error.message}</Alert>}

            <Button
              type="submit"
              fullWidth
              loading={createMutation.isPending}
              loadingLabel={SPLITS_MESSAGES.creatingSubmit}
            >
              {SPLITS_MESSAGES.createSubmit}
            </Button>
          </GlassCard>
        </form>
      </div>
    </AppShell>
  );
}
