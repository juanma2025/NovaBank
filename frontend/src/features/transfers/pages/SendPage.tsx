import {
  formatCOP,
  type RecipientPreview,
  TRANSFER_NOTE_MAX_LENGTH,
  type TransferLimits,
  type TransferResult,
} from '@nova/shared';
import { ArrowLeft } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { APP_MESSAGES, TRANSFER_MESSAGES } from '../../../lib/messages.ts';
import { useAccount } from '../../accounts/hooks/useAccount.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { RecipientField } from '../components/RecipientField.tsx';
import { TransferAmountForm } from '../components/TransferAmountForm.tsx';
import { TransferConfirmDialog } from '../components/TransferConfirmDialog.tsx';
import { TransferSuccessView } from '../components/TransferSuccessView.tsx';
import { useCreateTransfer } from '../hooks/useCreateTransfer.ts';
import { useRecipient } from '../hooks/useRecipient.ts';
import { useTransferLimits } from '../hooks/useTransferLimits.ts';

function validateTransferAmount(
  raw: string,
  parsed: number | null,
  limits: TransferLimits | undefined,
  availableBalance: number | undefined,
): string | undefined {
  if (raw.trim() === '') return TRANSFER_MESSAGES.validationRequired;
  if (parsed === null) return TRANSFER_MESSAGES.validationInvalid;
  if (limits) {
    if (parsed < limits.minAmount || parsed > limits.maxAmount) {
      return TRANSFER_MESSAGES.validationOutOfRange(
        formatCOP(limits.minAmount),
        formatCOP(limits.maxAmount),
      );
    }
    if (parsed > limits.remainingToday) {
      return limits.remainingToday <= 0
        ? TRANSFER_MESSAGES.dailyLimitReached
        : TRANSFER_MESSAGES.validationExceedsRemaining(formatCOP(limits.remainingToday));
    }
  }
  if (availableBalance !== undefined && parsed > availableBalance) {
    return TRANSFER_MESSAGES.validationInsufficientFunds(formatCOP(availableBalance));
  }
  return undefined;
}

export default function SendPage() {
  const accountQuery = useAccount();
  const limitsQuery = useTransferLimits();
  const recipientMutation = useRecipient();
  const createTransfer = useCreateTransfer();
  const { hidden: balanceHidden } = useBalanceVisibility();

  const [recipient, setRecipient] = useState<RecipientPreview | null>(null);
  const [recipientError, setRecipientError] = useState<string | undefined>(undefined);
  const [rawAmount, setRawAmount] = useState('');
  const [parsedAmount, setParsedAmount] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);
  const [reauthLocked, setReauthLocked] = useState(false);
  const [completed, setCompleted] = useState<{
    result: TransferResult;
    recipientName: string;
  } | null>(null);

  const limits = limitsQuery.data;
  const availableBalance = accountQuery.data?.balance;
  const dailyLimitReached = limits !== undefined && limits.remainingToday <= 0;
  const requiresReauth =
    parsedAmount !== null && limits !== undefined && parsedAmount > limits.reauthThreshold;

  const amountError = touched
    ? validateTransferAmount(rawAmount, parsedAmount, limits, availableBalance)
    : undefined;
  const noteError =
    note.length > TRANSFER_NOTE_MAX_LENGTH
      ? TRANSFER_MESSAGES.validationNoteTooLong(TRANSFER_NOTE_MAX_LENGTH)
      : undefined;

  async function handleSearchRecipient(query: string): Promise<void> {
    setRecipientError(undefined);
    try {
      const preview = await recipientMutation.mutateAsync(query);
      setRecipient(preview);
      createTransfer.resetAttempt();
    } catch (error) {
      if (error instanceof ApiError) setRecipientError(error.message);
    }
  }

  function handleContinue(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setTouched(true);
    setConfirmError(undefined);
    setReauthLocked(false);

    const err = validateTransferAmount(rawAmount, parsedAmount, limits, availableBalance);
    if (err || noteError || parsedAmount === null || !recipient) {
      setShakeKey((prev) => prev + 1);
      return;
    }

    setConfirmOpen(true);
  }

  async function handleConfirm(password?: string): Promise<void> {
    if (!recipient || parsedAmount === null || createTransfer.isPending) return;
    setConfirmError(undefined);

    const trimmedNote = note.trim();
    try {
      const result = await createTransfer.mutateAsync({
        recipientId: recipient.recipientId,
        amount: parsedAmount,
        ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
        ...(password !== undefined ? { password } : {}),
      });
      setConfirmOpen(false);
      setCompleted({ result, recipientName: recipient.displayName });
    } catch (error) {
      if (error instanceof ApiError) {
        setConfirmError(error.message);
        setReauthLocked(error.code === 'REAUTH_LOCKED');
      }
    }
  }

  function handleStartAnother(): void {
    setCompleted(null);
    setRecipient(null);
    setRecipientError(undefined);
    setRawAmount('');
    setParsedAmount(null);
    setNote('');
    setTouched(false);
    setConfirmError(undefined);
    setReauthLocked(false);
    createTransfer.resetAttempt();
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="space-y-3">
          <Link
            to="/inicio"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{TRANSFER_MESSAGES.backToHome}</span>
          </Link>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
              {TRANSFER_MESSAGES.pageTitle}
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              {TRANSFER_MESSAGES.pageSubtitle}
            </p>
          </div>
        </div>

        {completed ? (
          <TransferSuccessView
            result={completed.result}
            recipientName={completed.recipientName}
            balanceHidden={balanceHidden}
            onStartAnother={handleStartAnother}
          />
        ) : limitsQuery.isError ? (
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button
                  variant="secondary"
                  loading={limitsQuery.isFetching}
                  onClick={() => void limitsQuery.refetch()}
                >
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {limitsQuery.error.message || TRANSFER_MESSAGES.limitsError}
            </Alert>
          </GlassCard>
        ) : (
          <GlassCard className="space-y-6">
            {dailyLimitReached && (
              <Alert variant="warning">{TRANSFER_MESSAGES.dailyLimitReached}</Alert>
            )}

            <RecipientField
              recipient={recipient}
              isSearching={recipientMutation.isPending}
              serverError={recipientError}
              onSearch={(q) => void handleSearchRecipient(q)}
              onChangeRecipient={() => {
                setRecipient(null);
                setRecipientError(undefined);
                setConfirmError(undefined);
                createTransfer.resetAttempt();
              }}
              onClearError={() => setRecipientError(undefined)}
            />

            {recipient && (
              <TransferAmountForm
                rawAmount={rawAmount}
                note={note}
                limits={limits}
                limitsLoading={limitsQuery.isPending}
                availableBalance={availableBalance}
                balanceHidden={balanceHidden}
                dailyLimitReached={dailyLimitReached}
                requiresReauth={requiresReauth}
                amountError={amountError}
                noteError={noteError}
                shakeKey={shakeKey}
                onAmountChange={(parsed, formatted) => {
                  setParsedAmount(parsed);
                  setRawAmount(formatted);
                  setConfirmError(undefined);
                  createTransfer.resetAttempt();
                }}
                onAmountBlur={() => setTouched(true)}
                onNoteChange={(next) => {
                  setNote(next);
                  createTransfer.resetAttempt();
                }}
                onSubmit={handleContinue}
              />
            )}
          </GlassCard>
        )}

        {recipient && parsedAmount !== null && limits && (
          <TransferConfirmDialog
            open={confirmOpen}
            recipient={recipient}
            amount={parsedAmount}
            note={note}
            requiresReauth={requiresReauth}
            reauthThreshold={limits.reauthThreshold}
            isSubmitting={createTransfer.isPending}
            error={confirmError}
            isLockedError={reauthLocked}
            onConfirm={(password) => void handleConfirm(password)}
            onCancel={() => {
              setConfirmOpen(false);
              setConfirmError(undefined);
              setReauthLocked(false);
              createTransfer.resetAttempt();
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
