import { formatCOP, type SavingsLimits } from '@nova/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { SAVINGS_MESSAGES } from '../../../lib/messages.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { AmountInput } from '../../topups/components/AmountInput.tsx';

export interface SavingsAmountDialogProps {
  open: boolean;
  mode: 'deposit' | 'withdraw';
  availableAmount: number;
  balanceHidden: boolean;
  limits: SavingsLimits | undefined;
  isSubmitting: boolean;
  serverError?: string;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

export function SavingsAmountDialog({
  open,
  mode,
  availableAmount,
  balanceHidden,
  limits,
  isSubmitting,
  serverError,
  onConfirm,
  onCancel,
}: SavingsAmountDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [rawAmount, setRawAmount] = useState('');
  const [parsedAmount, setParsedAmount] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (!open) {
      setRawAmount('');
      setParsedAmount(null);
      setLocalError(undefined);
    }
  }, [open]);

  const isDeposit = mode === 'deposit';

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isSubmitting) return;

    if (rawAmount.trim() === '') {
      setLocalError(SAVINGS_MESSAGES.validationAmountRequired);
      setShakeKey((prev) => prev + 1);
      return;
    }
    if (parsedAmount === null) {
      setLocalError(SAVINGS_MESSAGES.validationAmountInvalid);
      setShakeKey((prev) => prev + 1);
      return;
    }
    if (limits) {
      if (parsedAmount < limits.minAmount || parsedAmount > limits.maxAmount) {
        setLocalError(
          SAVINGS_MESSAGES.validationAmountRange(
            formatCOP(limits.minAmount),
            formatCOP(limits.maxAmount),
          ),
        );
        setShakeKey((prev) => prev + 1);
        return;
      }
      if (parsedAmount > limits.remainingToday) {
        setLocalError(SAVINGS_MESSAGES.validationExceedsDaily(formatCOP(limits.remainingToday)));
        setShakeKey((prev) => prev + 1);
        return;
      }
    }
    if (parsedAmount > availableAmount) {
      setLocalError(
        isDeposit
          ? SAVINGS_MESSAGES.validationInsufficientMain(formatCOP(availableAmount))
          : SAVINGS_MESSAGES.validationInsufficientGoal(formatCOP(availableAmount)),
      );
      setShakeKey((prev) => prev + 1);
      return;
    }

    setLocalError(undefined);
    onConfirm(parsedAmount);
  }

  return (
    <ModalDialog
      open={open}
      titleId={titleId}
      descriptionId={descId}
      maxWidthClass="max-w-sm"
      preventClose={isSubmitting}
      onClose={onCancel}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em] text-text">
            {isDeposit ? SAVINGS_MESSAGES.depositTitle : SAVINGS_MESSAGES.withdrawTitle}
          </h2>
          <p id={descId} className="text-sm text-text-secondary">
            {isDeposit ? SAVINGS_MESSAGES.depositSubtitle : SAVINGS_MESSAGES.withdrawSubtitle}
          </p>
        </div>

        <p className="text-xs font-medium text-text-secondary tabular-nums">
          {isDeposit
            ? SAVINGS_MESSAGES.availableMainLabel(
                movementPresenter.formatBalance(availableAmount, balanceHidden),
              )
            : SAVINGS_MESSAGES.availableGoalLabel(
                movementPresenter.formatBalance(availableAmount, balanceHidden),
              )}
        </p>

        <AmountInput
          label={SAVINGS_MESSAGES.amountLabel}
          placeholder={SAVINGS_MESSAGES.amountPlaceholder}
          value={rawAmount}
          disabled={isSubmitting}
          error={localError}
          shakeKey={shakeKey}
          hint={
            limits
              ? SAVINGS_MESSAGES.limitsHint(
                  formatCOP(limits.minAmount),
                  formatCOP(limits.maxAmount),
                )
              : undefined
          }
          onValueChange={(parsed, formatted) => {
            setParsedAmount(parsed);
            setRawAmount(formatted);
            setLocalError(undefined);
          }}
        />

        {limits && (
          <p className="text-xs text-text-muted tabular-nums">
            {SAVINGS_MESSAGES.remainingTodayLabel(
              formatCOP(limits.remainingToday),
              formatCOP(limits.dailyLimit),
            )}
          </p>
        )}

        {serverError && <Alert variant="error">{serverError}</Alert>}

        <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={isSubmitting}
            onClick={onCancel}
          >
            {SAVINGS_MESSAGES.dialogCancel}
          </Button>
          <Button
            type="submit"
            fullWidth
            loading={isSubmitting}
            loadingLabel={isDeposit ? SAVINGS_MESSAGES.depositing : SAVINGS_MESSAGES.withdrawing}
          >
            {serverError
              ? SAVINGS_MESSAGES.retryAction
              : isDeposit
                ? SAVINGS_MESSAGES.depositSubmit
                : SAVINGS_MESSAGES.withdrawSubmit}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
