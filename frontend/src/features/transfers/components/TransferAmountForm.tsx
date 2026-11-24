import { formatCOP, TRANSFER_NOTE_MAX_LENGTH, type TransferLimits } from '@nova/shared';
import { ShieldAlert } from 'lucide-react';
import type { FormEvent } from 'react';

import { Button } from '../../../components/Button.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { TRANSFER_MESSAGES } from '../../../lib/messages.ts';
import { movementPresenter } from '../../accounts/services/movement-presenter.ts';
import { AmountInput } from '../../topups/components/AmountInput.tsx';

export interface TransferAmountFormProps {
  rawAmount: string;
  note: string;
  limits: TransferLimits | undefined;
  limitsLoading: boolean;
  availableBalance: number | undefined;
  balanceHidden: boolean;
  dailyLimitReached: boolean;
  requiresReauth: boolean;
  amountError?: string;
  noteError?: string;
  shakeKey: number;
  onAmountChange: (parsed: number | null, formatted: string) => void;
  onAmountBlur: () => void;
  onNoteChange: (nextNote: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function TransferAmountForm({
  rawAmount,
  note,
  limits,
  limitsLoading,
  availableBalance,
  balanceHidden,
  dailyLimitReached,
  requiresReauth,
  amountError,
  noteError,
  shakeKey,
  onAmountChange,
  onAmountBlur,
  onNoteChange,
  onSubmit,
}: TransferAmountFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="t-surface-enter space-y-5 border-t border-border pt-5"
    >
      {availableBalance !== undefined && (
        <p className="text-xs font-medium text-text-secondary tabular-nums">
          {TRANSFER_MESSAGES.availableBalanceLabel(
            movementPresenter.formatBalance(availableBalance, balanceHidden),
          )}
        </p>
      )}

      <AmountInput
        label={TRANSFER_MESSAGES.amountLabel}
        placeholder={TRANSFER_MESSAGES.amountPlaceholder}
        value={rawAmount}
        disabled={limitsLoading || dailyLimitReached}
        error={amountError}
        shakeKey={shakeKey}
        hint={
          limits
            ? TRANSFER_MESSAGES.limitsHint(formatCOP(limits.minAmount), formatCOP(limits.maxAmount))
            : TRANSFER_MESSAGES.loadingLimits
        }
        onValueChange={onAmountChange}
        onBlur={onAmountBlur}
      />

      {limits && !dailyLimitReached && (
        <p className="text-xs font-medium text-text-muted tabular-nums">
          {TRANSFER_MESSAGES.remainingTodayLabel(
            formatCOP(limits.remainingToday),
            formatCOP(limits.dailyLimit),
          )}
        </p>
      )}

      {requiresReauth && limits && (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-info-border bg-info-bg px-3.5 py-2.5 text-xs font-medium text-info">
          <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{TRANSFER_MESSAGES.reauthNotice(formatCOP(limits.reauthThreshold))}</span>
        </div>
      )}

      <div className="space-y-1">
        <TextField
          label={TRANSFER_MESSAGES.noteLabel}
          name="transferNote"
          placeholder={TRANSFER_MESSAGES.notePlaceholder}
          maxLength={TRANSFER_NOTE_MAX_LENGTH}
          value={note}
          disabled={limitsLoading || dailyLimitReached}
          error={noteError}
          onChange={(event) => onNoteChange(event.target.value)}
        />
        <p className="text-right text-xs text-text-muted tabular-nums">
          {TRANSFER_MESSAGES.noteCounter(note.length, TRANSFER_NOTE_MAX_LENGTH)}
        </p>
      </div>

      <Button type="submit" fullWidth disabled={limitsLoading || dailyLimitReached}>
        {TRANSFER_MESSAGES.continueSubmit}
      </Button>
    </form>
  );
}
