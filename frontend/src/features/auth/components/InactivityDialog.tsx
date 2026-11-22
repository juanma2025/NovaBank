import { Clock } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef } from 'react';

import { Button } from '../../../components/Button.tsx';
import { INACTIVITY_MESSAGES } from '../../../lib/messages.ts';

export interface InactivityDialogProps {
  open: boolean;
  secondsLeft: number;
  isRefreshing: boolean;
  onStayConnected: () => void;
  onLogoutNow: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function InactivityDialog({
  open,
  secondsLeft,
  isRefreshing,
  onStayConnected,
  onLogoutNow,
}: InactivityDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    primaryButtonRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[var(--blur-overlay)]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        className="nova-glass nova-animate-modal w-full max-w-sm rounded-[var(--radius-xl)] p-6 space-y-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-warning-border bg-warning-bg text-warning">
            <Clock aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 id={titleId} className="text-lg font-semibold tracking-[-0.02em] text-text">
              {INACTIVITY_MESSAGES.title}
            </h2>
            <p
              id={descriptionId}
              aria-live="polite"
              className="text-sm leading-relaxed text-text-secondary tabular-nums"
            >
              {INACTIVITY_MESSAGES.description(secondsLeft)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
          <Button
            ref={primaryButtonRef}
            variant="primary"
            fullWidth
            loading={isRefreshing}
            loadingLabel={INACTIVITY_MESSAGES.stayingConnected}
            onClick={onStayConnected}
          >
            {INACTIVITY_MESSAGES.stayConnected}
          </Button>
          <Button variant="secondary" fullWidth disabled={isRefreshing} onClick={onLogoutNow}>
            {INACTIVITY_MESSAGES.logoutNow}
          </Button>
        </div>
      </div>
    </div>
  );
}
