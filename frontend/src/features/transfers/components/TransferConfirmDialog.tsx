import { formatCOP, type RecipientPreview } from '@nova/shared';
import { type FormEvent, useEffect, useId, useState } from 'react';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { PasswordField } from '../../../components/PasswordField.tsx';
import { TRANSFER_MESSAGES } from '../../../lib/messages.ts';

export interface TransferConfirmDialogProps {
  open: boolean;
  recipient: RecipientPreview;
  amount: number;
  note: string;
  requiresReauth: boolean;
  reauthThreshold: number;
  isSubmitting: boolean;
  error?: string;
  isLockedError?: boolean;
  onConfirm: (password?: string) => void;
  onCancel: () => void;
}

/**
 * Diálogo de confirmación de transferencia con reautenticación condicional (spec 003, T018).
 * Muestra nombre parcial, correo enmascarado, monto, nota y pide contraseña solo si supera el umbral.
 */
export function TransferConfirmDialog({
  open,
  recipient,
  amount,
  note,
  requiresReauth,
  reauthThreshold,
  isSubmitting,
  error,
  isLockedError = false,
  onConfirm,
  onCancel,
}: TransferConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
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
    if (isSubmitting) return;

    if (requiresReauth && password.length === 0) {
      setPasswordError(TRANSFER_MESSAGES.confirmPasswordRequired);
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
      descriptionId={descriptionId}
      preventClose={isSubmitting}
      onClose={onCancel}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em] text-text">
            {TRANSFER_MESSAGES.confirmTitle}
          </h2>
          <p id={descriptionId} className="text-sm leading-relaxed text-text-secondary">
            {TRANSFER_MESSAGES.confirmSubtitle}
          </p>
        </div>

        <dl className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface-subtle/65 p-4 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-text-secondary">{TRANSFER_MESSAGES.confirmRecipientLabel}</dt>
            <dd className="text-right font-semibold text-text">{recipient.displayName}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
            <dt className="text-text-secondary">{TRANSFER_MESSAGES.confirmEmailLabel}</dt>
            <dd className="text-right text-text-secondary">{recipient.maskedEmail}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
            <dt className="text-text-secondary">{TRANSFER_MESSAGES.confirmAmountLabel}</dt>
            <dd className="text-right text-lg font-semibold text-text tabular-nums">
              {formatCOP(amount)}
            </dd>
          </div>
          {note.trim().length > 0 && (
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <dt className="shrink-0 text-text-secondary">{TRANSFER_MESSAGES.confirmNoteLabel}</dt>
              <dd className="min-w-0 text-right break-words text-text">{note.trim()}</dd>
            </div>
          )}
        </dl>

        {requiresReauth && (
          <PasswordField
            label={TRANSFER_MESSAGES.confirmPasswordLabel}
            name="confirmPassword"
            autoComplete="current-password"
            placeholder={TRANSFER_MESSAGES.confirmPasswordPlaceholder}
            value={password}
            disabled={isSubmitting || isLockedError}
            error={passwordError}
            shakeKey={shakeKey}
            hint={TRANSFER_MESSAGES.confirmPasswordHint(formatCOP(reauthThreshold))}
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
            {TRANSFER_MESSAGES.cancelAction}
          </Button>
          <Button
            type="submit"
            fullWidth
            disabled={isLockedError}
            loading={isSubmitting}
            loadingLabel={TRANSFER_MESSAGES.confirmingAction}
          >
            {error && !isLockedError
              ? TRANSFER_MESSAGES.retryAction
              : TRANSFER_MESSAGES.confirmAction}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
}
