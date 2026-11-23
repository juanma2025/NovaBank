import { formatCOP } from '@nova/shared';
import { useId } from 'react';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { SAVINGS_MESSAGES } from '../../../lib/messages.ts';

export interface CloseGoalDialogProps {
  open: boolean;
  goalName: string;
  goalBalance: number;
  isClosing: boolean;
  serverError?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diálogo de confirmación accesible para cerrar una meta mostrando el saldo a devolver. */
export function CloseGoalDialog({
  open,
  goalName,
  goalBalance,
  isClosing,
  serverError,
  onConfirm,
  onCancel,
}: CloseGoalDialogProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <ModalDialog
      open={open}
      titleId={titleId}
      descriptionId={descId}
      maxWidthClass="max-w-sm"
      preventClose={isClosing}
      onClose={onCancel}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em] text-text">
            {SAVINGS_MESSAGES.closeDialogTitle}
          </h2>
          <p id={descId} className="text-sm leading-relaxed text-text-secondary">
            {goalBalance > 0
              ? SAVINGS_MESSAGES.closeDialogWithBalance(goalName, formatCOP(goalBalance))
              : SAVINGS_MESSAGES.closeDialogEmpty(goalName)}
          </p>
        </div>

        {serverError && <Alert variant="error">{serverError}</Alert>}

        <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={isClosing}
            onClick={onCancel}
          >
            {SAVINGS_MESSAGES.dialogCancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            fullWidth
            loading={isClosing}
            loadingLabel={SAVINGS_MESSAGES.closingAction}
            onClick={onConfirm}
          >
            {SAVINGS_MESSAGES.closeDialogConfirm}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
