import { formatCOP } from '@nova/shared';
import { ShieldCheck } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef } from 'react';

import { Alert } from '../../../components/Alert.tsx';
import { Button } from '../../../components/Button.tsx';
import { TOPUP_MESSAGES } from '../../../lib/messages.ts';

export interface TopupConfirmDialogProps {
  open: boolean;
  amount: number;
  isSubmitting: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function TopupConfirmDialog({
  open,
  amount,
  isSubmitting,
  error,
  onConfirm,
  onCancel,
}: TopupConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape' && !isSubmitting) {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="t-modal-backdrop is-open fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[var(--blur-overlay)]"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        className="nova-glass t-modal is-open w-full max-w-md space-y-5 rounded-[var(--radius-xl)] p-6"
      >
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-info-border bg-info-bg text-info">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className="text-lg font-semibold tracking-[-0.02em] text-text">
              {TOPUP_MESSAGES.confirmTitle}
            </h2>
            <p id={descriptionId} className="text-sm leading-relaxed text-text-secondary">
              {TOPUP_MESSAGES.confirmSubtitle}
            </p>
          </div>
        </div>

        <dl className="divide-y divide-border rounded-[var(--radius-md)] border border-border bg-surface/80 px-4">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-sm text-text-secondary">{TOPUP_MESSAGES.confirmAmountLabel}</dt>
            <dd className="text-lg font-semibold text-text tabular-nums">{formatCOP(amount)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-sm text-text-secondary">{TOPUP_MESSAGES.confirmOriginLabel}</dt>
            <dd className="text-right text-sm font-medium text-text">
              {TOPUP_MESSAGES.confirmOriginValue}
            </dd>
          </div>
        </dl>

        <Alert variant="info">{TOPUP_MESSAGES.confirmDemoWarning}</Alert>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex flex-col gap-2.5 border-t border-border pt-4 sm:flex-row-reverse">
          <Button
            ref={confirmButtonRef}
            variant="primary"
            fullWidth
            loading={isSubmitting}
            loadingLabel={TOPUP_MESSAGES.confirmingAction}
            onClick={onConfirm}
          >
            {error ? TOPUP_MESSAGES.retryAction : TOPUP_MESSAGES.confirmAction}
          </Button>
          <Button variant="secondary" fullWidth disabled={isSubmitting} onClick={onCancel}>
            {TOPUP_MESSAGES.cancelAction}
          </Button>
        </div>
      </div>
    </div>
  );
}
