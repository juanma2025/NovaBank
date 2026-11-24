import { BUDGET_LIMIT_MAX, BUDGET_LIMIT_MIN, type BudgetCategory, formatCOP } from '@nova/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { BUDGET_MESSAGES } from '../../../lib/messages.ts';
import { AmountInput, formatCOPDigits } from '../../topups/components/AmountInput.tsx';

export interface BudgetLimitDialogProps {
  open: boolean;
  category: BudgetCategory | null;
  currentLimit: number | null;
  isSaving: boolean;
  isRemoving: boolean;
  serverError?: string;
  onSave: (category: BudgetCategory, monthlyLimit: number) => void;
  onRemove: (category: BudgetCategory) => void;
  onCancel: () => void;
}

/** Diálogo accesible para definir, editar o quitar un tope mensual de categoría (spec 006). */
export function BudgetLimitDialog({
  open,
  category,
  currentLimit,
  isSaving,
  isRemoving,
  serverError,
  onSave,
  onRemove,
  onCancel,
}: BudgetLimitDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [rawLimit, setRawLimit] = useState('');
  const [parsedLimit, setParsedLimit] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);

  const busy = isSaving || isRemoving;

  useEffect(() => {
    if (!open) return;
    setParsedLimit(currentLimit);
    setRawLimit(currentLimit !== null ? formatCOPDigits(currentLimit) : '');
    setLocalError(undefined);
  }, [open, currentLimit, category]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!category || busy) return;

    if (rawLimit.trim() === '') {
      setLocalError(BUDGET_MESSAGES.validationRequired);
      setShakeKey((prev) => prev + 1);
      return;
    }
    if (parsedLimit === null) {
      setLocalError(BUDGET_MESSAGES.validationInvalid);
      setShakeKey((prev) => prev + 1);
      return;
    }
    if (parsedLimit < BUDGET_LIMIT_MIN || parsedLimit > BUDGET_LIMIT_MAX) {
      setLocalError(
        BUDGET_MESSAGES.validationRange(formatCOP(BUDGET_LIMIT_MIN), formatCOP(BUDGET_LIMIT_MAX)),
      );
      setShakeKey((prev) => prev + 1);
      return;
    }

    setLocalError(undefined);
    onSave(category, parsedLimit);
  }

  return (
    <ModalDialog
      open={open && category !== null}
      titleId={titleId}
      descriptionId={descId}
      maxWidthClass="max-w-sm"
      preventClose={busy}
      onClose={onCancel}
    >
      {category && (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1">
            <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em] text-text">
              {BUDGET_MESSAGES.dialogSetTitle(category)}
            </h2>
            <p id={descId} className="text-sm text-text-secondary">
              {BUDGET_MESSAGES.dialogSubtitle}
            </p>
          </div>

          <AmountInput
            label={BUDGET_MESSAGES.limitInputLabel}
            placeholder={BUDGET_MESSAGES.limitPlaceholder}
            value={rawLimit}
            disabled={busy}
            error={localError}
            shakeKey={shakeKey}
            hint={BUDGET_MESSAGES.limitHint(
              formatCOP(BUDGET_LIMIT_MIN),
              formatCOP(BUDGET_LIMIT_MAX),
            )}
            onValueChange={(parsed, formatted) => {
              setParsedLimit(parsed);
              setRawLimit(formatted);
              setLocalError(undefined);
            }}
          />

          {serverError && <Alert variant="error">{serverError}</Alert>}

          <div className="space-y-2.5 border-t border-border pt-4">
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={busy}
                onClick={onCancel}
              >
                {BUDGET_MESSAGES.cancelAction}
              </Button>
              <Button
                type="submit"
                fullWidth
                disabled={isRemoving}
                loading={isSaving}
                loadingLabel={BUDGET_MESSAGES.savingLimit}
              >
                {BUDGET_MESSAGES.saveLimitAction}
              </Button>
            </div>

            {currentLimit !== null && (
              <Button
                type="button"
                variant="danger"
                fullWidth
                disabled={isSaving}
                loading={isRemoving}
                loadingLabel={BUDGET_MESSAGES.removingLimit}
                onClick={() => onRemove(category)}
              >
                {BUDGET_MESSAGES.removeLimitAction}
              </Button>
            )}
          </div>
        </form>
      )}
    </ModalDialog>
  );
}
