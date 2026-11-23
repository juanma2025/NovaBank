import { formatCOP, type TopupLimits, type TopupResult } from '@nova/shared';
import { ArrowLeft } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { SuccessCheck } from '../../../components/SuccessCheck.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { APP_MESSAGES, MOVEMENT_MESSAGES, TOPUP_MESSAGES } from '../../../lib/messages.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { AmountInput, formatCOPDigits } from '../components/AmountInput.tsx';
import { SuggestedAmounts } from '../components/SuggestedAmounts.tsx';
import { TopupConfirmDialog } from '../components/TopupConfirmDialog.tsx';
import { useCreateTopup } from '../hooks/useCreateTopup.ts';
import { useTopupLimits } from '../hooks/useTopupLimits.ts';

function validateAmountAgainstLimits(
  raw: string,
  parsed: number | null,
  limits: TopupLimits | undefined,
): string | undefined {
  if (raw.trim() === '') return TOPUP_MESSAGES.validationRequired;
  if (parsed === null) return TOPUP_MESSAGES.validationInvalid;
  if (!limits) return undefined;
  if (parsed < limits.minAmount || parsed > limits.maxAmount) {
    return TOPUP_MESSAGES.validationOutOfRange(
      formatCOP(limits.minAmount),
      formatCOP(limits.maxAmount),
    );
  }
  if (parsed > limits.remainingToday) {
    return limits.remainingToday <= 0
      ? TOPUP_MESSAGES.dailyLimitReached
      : TOPUP_MESSAGES.validationExceedsRemaining(formatCOP(limits.remainingToday));
  }
  return undefined;
}

export default function TopupPage() {
  const limitsQuery = useTopupLimits();
  const createTopup = useCreateTopup();
  const { hidden: balanceHidden } = useBalanceVisibility();

  const [rawAmount, setRawAmount] = useState('');
  const [parsedAmount, setParsedAmount] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | undefined>(undefined);
  const [completedResult, setCompletedResult] = useState<TopupResult | null>(null);

  const limits = limitsQuery.data;
  const dailyLimitReached = limits !== undefined && limits.remainingToday <= 0;
  const fieldError = touched
    ? validateAmountAgainstLimits(rawAmount, parsedAmount, limits)
    : undefined;

  function handleSelectSuggested(amount: number): void {
    setParsedAmount(amount);
    setRawAmount(formatCOPDigits(amount));
    setTouched(false);
    setConfirmError(undefined);
    createTopup.resetAttempt();
  }

  function handleContinue(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setTouched(true);
    setConfirmError(undefined);

    const validationError = validateAmountAgainstLimits(rawAmount, parsedAmount, limits);
    if (validationError || parsedAmount === null) {
      setShakeKey((prev) => prev + 1);
      return;
    }

    setConfirmOpen(true);
  }

  async function handleConfirm(): Promise<void> {
    if (parsedAmount === null || createTopup.isPending) return;
    setConfirmError(undefined);

    try {
      const result = await createTopup.mutateAsync(parsedAmount);
      setConfirmOpen(false);
      setCompletedResult(result);
    } catch (error) {
      if (error instanceof ApiError) {
        setConfirmError(error.message);
      }
    }
  }

  function handleCancelConfirm(): void {
    setConfirmOpen(false);
    setConfirmError(undefined);
    createTopup.resetAttempt();
  }

  function handleStartAnother(): void {
    setCompletedResult(null);
    setRawAmount('');
    setParsedAmount(null);
    setTouched(false);
    setConfirmError(undefined);
    createTopup.resetAttempt();
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
            <span>{MOVEMENT_MESSAGES.backToHome}</span>
          </Link>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
              {TOPUP_MESSAGES.pageTitle}
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              {TOPUP_MESSAGES.pageSubtitle}
            </p>
          </div>
        </div>

        <Alert variant="info" title={TOPUP_MESSAGES.demoNoticeTitle}>
          {TOPUP_MESSAGES.demoNoticeBody}
        </Alert>

        {completedResult ? (
          <>
            <div
              role="status"
              aria-live="polite"
              className="t-toast is-open flex items-center gap-3 rounded-[var(--radius-md)] border border-success-border bg-success-bg px-4 py-3 text-sm font-medium text-success"
            >
              <SuccessCheck className="h-[18px] w-[18px] shrink-0" />
              <span>{TOPUP_MESSAGES.successToast(formatCOP(completedResult.movement.amount))}</span>
            </div>

            <GlassCard className="t-surface-enter space-y-6">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-success-border bg-success-bg text-success">
                  <SuccessCheck className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-[-0.02em] text-text">
                    {TOPUP_MESSAGES.successTitle}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {completedResult.movement.description} ·{' '}
                    <span className="font-semibold text-success tabular-nums">
                      +{formatCOP(completedResult.movement.amount)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-sm text-text-secondary">
                  {TOPUP_MESSAGES.successNewBalanceLabel}
                </span>
                <span className="text-xl font-semibold text-text tabular-nums">
                  {movementPresenter.formatBalance(completedResult.balance, balanceHidden)}
                </span>
              </div>

              <div className="flex flex-col gap-2.5 border-t border-border pt-4 sm:flex-row">
                <Link
                  to="/inicio"
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-md)] bg-brand px-4 py-2.5 text-[15px] font-semibold text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-brand-hover"
                >
                  {TOPUP_MESSAGES.successGoHome}
                </Link>
                <Button variant="secondary" fullWidth onClick={handleStartAnother}>
                  {TOPUP_MESSAGES.successAnother}
                </Button>
              </div>
            </GlassCard>
          </>
        ) : limitsQuery.isError ? (
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button
                  variant="secondary"
                  loading={limitsQuery.isFetching}
                  onClick={() => {
                    void limitsQuery.refetch();
                  }}
                >
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {limitsQuery.error.message || TOPUP_MESSAGES.limitsError}
            </Alert>
          </GlassCard>
        ) : (
          <GlassCard className="space-y-5">
            {dailyLimitReached && (
              <Alert variant="warning">{TOPUP_MESSAGES.dailyLimitReached}</Alert>
            )}

            <form onSubmit={handleContinue} noValidate className="space-y-5">
              <AmountInput
                label={TOPUP_MESSAGES.amountLabel}
                placeholder={TOPUP_MESSAGES.amountPlaceholder}
                value={rawAmount}
                disabled={limitsQuery.isPending || dailyLimitReached}
                error={fieldError}
                shakeKey={shakeKey}
                hint={
                  limits
                    ? TOPUP_MESSAGES.limitsHint(
                        formatCOP(limits.minAmount),
                        formatCOP(limits.maxAmount),
                      )
                    : TOPUP_MESSAGES.loadingLimits
                }
                onValueChange={(parsed, formatted) => {
                  setParsedAmount(parsed);
                  setRawAmount(formatted);
                  setConfirmError(undefined);
                  createTopup.resetAttempt();
                }}
                onBlur={() => setTouched(true)}
              />

              {limits && !dailyLimitReached && (
                <p className="text-xs font-medium text-text-muted tabular-nums">
                  {TOPUP_MESSAGES.remainingTodayLabel(
                    formatCOP(limits.remainingToday),
                    formatCOP(limits.dailyLimit),
                  )}
                </p>
              )}

              <SuggestedAmounts
                selectedAmount={parsedAmount}
                limits={limits}
                disabled={limitsQuery.isPending || dailyLimitReached}
                onSelect={handleSelectSuggested}
              />

              <Button type="submit" fullWidth disabled={limitsQuery.isPending || dailyLimitReached}>
                {TOPUP_MESSAGES.continueSubmit}
              </Button>
            </form>
          </GlassCard>
        )}

        {parsedAmount !== null && (
          <TopupConfirmDialog
            open={confirmOpen}
            amount={parsedAmount}
            isSubmitting={createTopup.isPending}
            error={confirmError}
            onConfirm={() => {
              void handleConfirm();
            }}
            onCancel={handleCancelConfirm}
          />
        )}
      </div>
    </AppShell>
  );
}
