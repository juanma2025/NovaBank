import {
  type CardPaymentResult,
  DEMO_MERCHANTS,
  formatCOP,
  isValidCardNumber,
  type MerchantId,
  normalizeCardNumber,
} from '@nova/shared';
import { ArrowLeft } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { ApiError } from '../../../lib/http-client.ts';
import { APP_MESSAGES, STORE_MESSAGES } from '../../../lib/messages.ts';
import { useAccount } from '../../accounts/hooks/useAccount.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { BudgetAlertToast } from '../../budgets/components/BudgetAlertToast.tsx';
import { AmountInput } from '../../topups/components/AmountInput.tsx';
import { CardPaymentFields } from '../components/CardPaymentFields.tsx';
import { MerchantPicker } from '../components/MerchantPicker.tsx';
import { StoreSuccessView } from '../components/StoreSuccessView.tsx';
import { useCreateCardPayment, useStoreLimits } from '../hooks/useStore.ts';
import {
  CVV_REGEX,
  EXPIRY_REGEX,
  isStoreCardFormValid,
  validateStoreAmount,
} from '../utils/validate-store.ts';

export default function StorePage() {
  const accountQuery = useAccount();
  const limitsQuery = useStoreLimits();
  const createPayment = useCreateCardPayment();
  const { hidden: balanceHidden } = useBalanceVisibility();

  const [merchantId, setMerchantId] = useState<MerchantId>(DEMO_MERCHANTS[0].id);
  const [rawAmount, setRawAmount] = useState('');
  const [parsedAmount, setParsedAmount] = useState<number | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [touched, setTouched] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [locked, setLocked] = useState(false);
  const [completed, setCompleted] = useState<{
    result: CardPaymentResult;
    merchantName: string;
  } | null>(null);

  const limits = limitsQuery.data;
  const availableBalance = accountQuery.data?.balance;
  const dailyLimitReached = limits !== undefined && limits.remainingToday <= 0;
  const selectedMerchant =
    DEMO_MERCHANTS.find((item) => item.id === merchantId) ?? DEMO_MERCHANTS[0];

  const digits = normalizeCardNumber(cardNumber);
  const cardNumberError =
    (touched || digits.length === 16) && !isValidCardNumber(cardNumber)
      ? STORE_MESSAGES.validationCardNumber
      : undefined;
  const expiryError =
    (touched || expiry.length === 5) && !EXPIRY_REGEX.test(expiry)
      ? STORE_MESSAGES.validationExpiry
      : undefined;
  const cvvError =
    (touched || cvv.length === 3) && !CVV_REGEX.test(cvv)
      ? STORE_MESSAGES.validationCvv
      : undefined;
  const amountError = touched
    ? validateStoreAmount(rawAmount, parsedAmount, limits, availableBalance)
    : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (createPayment.isPending) return;
    setTouched(true);
    setSubmitError(undefined);
    setLocked(false);

    const amtErr = validateStoreAmount(rawAmount, parsedAmount, limits, availableBalance);
    if (amtErr || parsedAmount === null || !isStoreCardFormValid(cardNumber, expiry, cvv)) {
      setShakeKey((prev) => prev + 1);
      return;
    }

    try {
      const result = await createPayment.mutateAsync({
        merchantId,
        amount: parsedAmount,
        cardNumber: normalizeCardNumber(cardNumber),
        expiry,
        cvv,
      });
      clearSensitiveFields();
      setCompleted({ result, merchantName: selectedMerchant.name });
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
        setLocked(error.code === 'CARD_PAYMENTS_LOCKED');
      }
    }
  }

  function clearSensitiveFields(): void {
    setCardNumber('');
    setExpiry('');
    setCvv('');
  }

  function handleStartAnother(): void {
    setCompleted(null);
    setRawAmount('');
    setParsedAmount(null);
    clearSensitiveFields();
    setTouched(false);
    setSubmitError(undefined);
    setLocked(false);
    createPayment.resetAttempt();
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="space-y-3">
          <Link
            to="/inicio"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{STORE_MESSAGES.backToHome}</span>
          </Link>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
              {STORE_MESSAGES.pageTitle}
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              {STORE_MESSAGES.pageSubtitle}
            </p>
          </div>
        </div>

        <Alert variant="info" title={STORE_MESSAGES.demoNoticeTitle}>
          {STORE_MESSAGES.demoNoticeBody}
        </Alert>

        {completed ? (
          <div className="space-y-4">
            <BudgetAlertToast active />
            <StoreSuccessView
              result={completed.result}
              merchantName={completed.merchantName}
              balanceHidden={balanceHidden}
              onStartAnother={handleStartAnother}
            />
          </div>
        ) : limitsQuery.isError ? (
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button variant="secondary" onClick={() => void limitsQuery.refetch()}>
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {limitsQuery.error.message || STORE_MESSAGES.limitsError}
            </Alert>
          </GlassCard>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-6">
            <MerchantPicker
              selectedId={merchantId}
              onSelect={(id) => {
                setMerchantId(id);
                setSubmitError(undefined);
                createPayment.resetAttempt();
              }}
            />

            <GlassCard className="space-y-5">
              <h2 className="text-base font-semibold tracking-[-0.02em] text-text">
                {STORE_MESSAGES.paymentSectionTitle}
              </h2>

              {dailyLimitReached && (
                <Alert variant="warning">{STORE_MESSAGES.dailyLimitReached}</Alert>
              )}

              {availableBalance !== undefined && (
                <p className="text-xs font-medium text-text-secondary tabular-nums">
                  {STORE_MESSAGES.availableBalanceLabel(
                    movementPresenter.formatBalance(availableBalance, balanceHidden),
                  )}
                </p>
              )}

              <AmountInput
                label={STORE_MESSAGES.amountLabel}
                placeholder={STORE_MESSAGES.amountPlaceholder}
                value={rawAmount}
                disabled={limitsQuery.isPending || dailyLimitReached || locked}
                error={amountError}
                shakeKey={shakeKey}
                hint={
                  limits
                    ? STORE_MESSAGES.limitsHint(
                        formatCOP(limits.minAmount),
                        formatCOP(limits.maxAmount),
                      )
                    : STORE_MESSAGES.loadingLimits
                }
                onValueChange={(parsed, formatted) => {
                  setParsedAmount(parsed);
                  setRawAmount(formatted);
                  setSubmitError(undefined);
                  createPayment.resetAttempt();
                }}
              />

              {limits && !dailyLimitReached && (
                <p className="text-xs font-medium text-text-muted tabular-nums">
                  {STORE_MESSAGES.remainingTodayLabel(
                    formatCOP(limits.remainingToday),
                    formatCOP(limits.dailyLimit),
                  )}
                </p>
              )}

              <CardPaymentFields
                cardNumber={cardNumber}
                expiry={expiry}
                cvv={cvv}
                disabled={limitsQuery.isPending || dailyLimitReached || locked}
                cardNumberError={cardNumberError}
                expiryError={expiryError}
                cvvError={cvvError}
                shakeKey={shakeKey}
                onCardNumberChange={(v) => {
                  setCardNumber(v);
                  setSubmitError(undefined);
                }}
                onExpiryChange={(v) => {
                  setExpiry(v);
                  setSubmitError(undefined);
                }}
                onCvvChange={(v) => {
                  setCvv(v);
                  setSubmitError(undefined);
                }}
              />

              {submitError && <Alert variant={locked ? 'warning' : 'error'}>{submitError}</Alert>}

              <Button
                type="submit"
                fullWidth
                disabled={limitsQuery.isPending || dailyLimitReached || locked}
                loading={createPayment.isPending}
                loadingLabel={STORE_MESSAGES.payingSubmit}
              >
                {submitError && !locked ? STORE_MESSAGES.retrySubmit : STORE_MESSAGES.paySubmit}
              </Button>
            </GlassCard>
          </form>
        )}
      </div>
    </AppShell>
  );
}
