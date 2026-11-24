import { formatCOP } from '@nova/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { SPLITS_MESSAGES } from '../../../lib/messages.ts';

export interface PayShareDialogProps {
  open: boolean;
  splitTitle: string;
  creatorName: string;
  amount: number;
  requiresReauth: boolean;
  reauthThreshold?: number;
  isSubmitting: boolean;
  error?: string;
  isLockedError?: boolean;
  onConfirm: (password?: string) => void;
  onCancel: () => void;
}

/** Modal accesible de confirmación para «Pagar mi parte» con reautenticación condicional (spec 007). */
export function PayShareDialog({
  open,
  splitTitle,
  creatorName,
  amount,
  requiresReauth,
  reauthThreshold,
  isSubmitting,
  error,
  isLockedError = false,
  onConfirm,
  onCancel,
}: PayShareDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setPasswordError(undefined);
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isSubmitting || isLockedError) return;

    if (requiresReauth && password.length === 0) {
      setPasswordError(SPLITS_MESSAGES.payDialogPasswordRequired);
      setShakeKey((prev) => prev + 1);
      return;
    }

    setPasswordError(undefined);
    onConfirm(requiresReauth ? password : undefined);
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
            {SPLITS_MESSAGES.payDialogTitle}
          </h2>
          <p id={descId} className="text-sm text-text-secondary">
            {SPLITS_MESSAGES.payDialogSubtitle}
          </p>
        </div>

        <dl className="space-y-2 rounded-[var(--radius-md)] border border-border bg-surface-subtle/60 p-3.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-text-secondary">{SPLITS_MESSAGES.payDialogRecipientLabel}</dt>
            <dd className="font-semibold text-text">{creatorName}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-text-secondary">{SPLITS_MESSAGES.payDialogAmountLabel}</dt>
            <dd className="text-base font-semibold text-text tabular-nums">{formatCOP(amount)}</dd>
          </div>
          <div className="flex items-start justify-between gap-2 border-t border-border pt-2">
            <dt className="shrink-0 text-text-secondary">{SPLITS_MESSAGES.payDialogNoteLabel}</dt>
            <dd className="text-right text-xs font-medium text-text">
              {SPLITS_MESSAGES.payDialogNoteValue(splitTitle)}
            </dd>
          </div>
        </dl>

        {requiresReauth && (
          <PasswordField
            label={SPLITS_MESSAGES.payDialogPasswordLabel}
            name="splitPayPassword"
            autoComplete="current-password"
            placeholder={SPLITS_MESSAGES.payDialogPasswordPlaceholder}
            value={password}
            disabled={isSubmitting || isLockedError}
            error={passwordError}
            shakeKey={shakeKey}
            hint={
              reauthThreshold !== undefined
                ? SPLITS_MESSAGES.payDialogPasswordHint(formatCOP(reauthThreshold))
                : undefined
            }
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError(undefined);
            }}
          />
        )}

        {error && <Alert variant={isLockedError ? 'warning' : 'error'}>{error}</Alert>}

        <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={isSubmitting}
            onClick={onCancel}
          >
            {SPLITS_MESSAGES.dialogCancel}
          </Button>
          <Button
            type="submit"
            fullWidth
            disabled={isLockedError}
            loading={isSubmitting}
            loadingLabel={SPLITS_MESSAGES.payDialogPaying}
          >
            {error && !isLockedError
              ? SPLITS_MESSAGES.payDialogRetry
              : SPLITS_MESSAGES.payDialogConfirm}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
