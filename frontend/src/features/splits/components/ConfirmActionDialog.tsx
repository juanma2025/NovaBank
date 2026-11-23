import { useId } from 'react';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { ModalDialog } from '../../../components/ModalDialog.tsx';
import { SPLITS_MESSAGES } from '../../../lib/messages.ts';

export interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel: string;
  isLoading: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Diálogo de confirmación accesible reutilizado para rechazar parte o cancelar división. */
export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  loadingLabel,
  isLoading,
  error,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <ModalDialog
      open={open}
      titleId={titleId}
      descriptionId={descId}
      maxWidthClass="max-w-sm"
      preventClose={isLoading}
      onClose={onCancel}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <h2 id={titleId} className="text-xl font-semibold tracking-[-0.025em] text-text">
            {title}
          </h2>
          <p id={descId} className="text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex flex-col-reverse gap-2.5 border-t border-border pt-4 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={isLoading}
            onClick={onCancel}
          >
            {SPLITS_MESSAGES.dialogCancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            fullWidth
            loading={isLoading}
            loadingLabel={loadingLabel}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );
}
