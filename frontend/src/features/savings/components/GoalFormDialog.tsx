import {
  addYearsToIsoDate,
  bogotaToday,
  formatCOP,
  GOAL_DATE_MAX_YEARS,
  GOAL_NAME_MAX_LENGTH,
  SAVINGS_TARGET_MAX,
  SAVINGS_TARGET_MIN,
} from '@nova/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { TextField } from '../../../components/TextField.tsx';
import { SAVINGS_MESSAGES } from '../../../lib/messages.ts';
import { AmountInput, formatCOPDigits } from '../../topups/components/AmountInput.tsx';

export interface GoalFormValues {
  name: string;
  targetAmount: number;
  targetDate: string | null;
}

export interface GoalFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValues?: GoalFormValues;
  isSubmitting: boolean;
  serverError?: string;
  onSubmit: (values: GoalFormValues) => void;
  onCancel: () => void;
}

export function GoalFormDialog({
  open,
  mode,
  initialValues,
  isSubmitting,
  serverError,
  onSubmit,
  onCancel,
}: GoalFormDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [name, setName] = useState('');
  const [rawTarget, setRawTarget] = useState('');
  const [parsedTarget, setParsedTarget] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [targetError, setTargetError] = useState<string | undefined>(undefined);
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);

  const today = bogotaToday(new Date());
  const maxDate = addYearsToIsoDate(today, GOAL_DATE_MAX_YEARS);

  useEffect(() => {
    if (!open) return;
    setName(initialValues?.name ?? '');
    setParsedTarget(initialValues?.targetAmount ?? null);
    setRawTarget(initialValues ? formatCOPDigits(initialValues.targetAmount) : '');
    setTargetDate(initialValues?.targetDate ?? '');
    setNameError(undefined);
    setTargetError(undefined);
    setDateError(undefined);
  }, [open, initialValues]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    let hasError = false;

    if (trimmedName.length === 0) {
      setNameError(SAVINGS_MESSAGES.validationNameRequired);
      hasError = true;
    } else if (trimmedName.length > GOAL_NAME_MAX_LENGTH) {
      setNameError(SAVINGS_MESSAGES.validationNameTooLong(GOAL_NAME_MAX_LENGTH));
      hasError = true;
    } else {
      setNameError(undefined);
    }

    if (rawTarget.trim() === '' || parsedTarget === null) {
      setTargetError(SAVINGS_MESSAGES.validationTargetRequired);
      hasError = true;
    } else if (parsedTarget < SAVINGS_TARGET_MIN || parsedTarget > SAVINGS_TARGET_MAX) {
      setTargetError(
        SAVINGS_MESSAGES.validationTargetRange(
          formatCOP(SAVINGS_TARGET_MIN),
          formatCOP(SAVINGS_TARGET_MAX),
        ),
      );
      hasError = true;
    } else {
      setTargetError(undefined);
    }

    const cleanDate = targetDate.trim();
    if (cleanDate.length > 0 && cleanDate < today) {
      setDateError(SAVINGS_MESSAGES.validationDatePast);
      hasError = true;
    } else if (cleanDate.length > 0 && cleanDate > maxDate) {
      setDateError(SAVINGS_MESSAGES.validationDateMax(GOAL_DATE_MAX_YEARS));
      hasError = true;
    } else {
      setDateError(undefined);
    }

    if (hasError || parsedTarget === null) {
      setShakeKey((prev) => prev + 1);
      return;
    }

    onSubmit({
      name: trimmedName,
      targetAmount: parsedTarget,
      targetDate: cleanDate.length > 0 ? cleanDate : null,
    });
  }

  const isCreate = mode === 'create';

  return (
    <ModalDialog
      open={open}
      titleId={titleId}
      descriptionId={descId}
      preventClose={isSubmitting}
      onClose={onCancel}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1">
          <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em] text-text">
            {isCreate ? SAVINGS_MESSAGES.formCreateTitle : SAVINGS_MESSAGES.formEditTitle}
          </h2>
          <p id={descId} className="text-sm text-text-secondary">
            {isCreate ? SAVINGS_MESSAGES.formCreateSubtitle : SAVINGS_MESSAGES.formEditSubtitle}
          </p>
        </div>

        <TextField
          label={SAVINGS_MESSAGES.nameLabel}
          name="goalName"
          placeholder={SAVINGS_MESSAGES.namePlaceholder}
          maxLength={GOAL_NAME_MAX_LENGTH}
          value={name}
          disabled={isSubmitting}
          error={nameError}
          shakeKey={shakeKey}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(undefined);
          }}
        />

        <AmountInput
          label={SAVINGS_MESSAGES.targetAmountLabel}
          placeholder={SAVINGS_MESSAGES.targetAmountPlaceholder}
          value={rawTarget}
          disabled={isSubmitting}
          error={targetError}
          shakeKey={shakeKey}
          onValueChange={(parsed, formatted) => {
            setParsedTarget(parsed);
            setRawTarget(formatted);
            setTargetError(undefined);
          }}
        />

        <div className="space-y-1">
          <TextField
            label={SAVINGS_MESSAGES.targetDateInputLabel}
            name="goalTargetDate"
            type="date"
            min={today}
            max={maxDate}
            value={targetDate}
            disabled={isSubmitting}
            error={dateError}
            hint={SAVINGS_MESSAGES.targetDateHint}
            onChange={(event) => {
              setTargetDate(event.target.value);
              setDateError(undefined);
            }}
          />
          {targetDate.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTargetDate('');
                setDateError(undefined);
              }}
              className="inline-flex min-h-11 cursor-pointer items-center text-xs font-semibold text-brand-text underline"
            >
              {SAVINGS_MESSAGES.clearDateAction}
            </button>
          )}
        </div>

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
            loadingLabel={isCreate ? SAVINGS_MESSAGES.formCreating : SAVINGS_MESSAGES.formEditing}
          >
            {isCreate ? SAVINGS_MESSAGES.formCreateSubmit : SAVINGS_MESSAGES.formEditSubmit}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
