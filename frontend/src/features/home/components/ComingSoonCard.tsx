import { ChevronRight, Coins } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { Button } from '../../../components/Button.tsx';
import { HOME_MESSAGES } from '../../../lib/messages.ts';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tarjeta «Muy pronto» de wallet cripto (constitución Principio IV y FR-017).
 * Solo abre un diálogo informativo; no realiza llamadas a la API ni simula datos.
 */
export function ComingSoonCard() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
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
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="nova-glass group flex w-full cursor-pointer flex-col gap-4 rounded-[var(--radius-xl)] p-5 text-left transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:border-border-strong sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-violet/12 text-brand-violet">
            <Coins aria-hidden="true" className="h-5 w-5" />
          </span>

          <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-text-secondary">
            {HOME_MESSAGES.comingSoonBadge}
          </span>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
            {HOME_MESSAGES.comingSoonTitle}
          </h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            {HOME_MESSAGES.comingSoonSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-1 border-t border-border pt-3.5 text-sm font-semibold text-brand-text">
          <span>{HOME_MESSAGES.comingSoonAction}</span>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-hover:translate-x-0.5"
          />
        </div>
      </button>

      {open && (
        <div
          className="t-modal-backdrop is-open fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[var(--blur-overlay)]"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onKeyDown={handleDialogKeyDown}
            className="nova-glass t-modal is-open w-full max-w-sm space-y-5 rounded-[var(--radius-xl)] p-6"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-violet/12 text-brand-violet">
                <Coins aria-hidden="true" className="h-5 w-5" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <h2 id={titleId} className="text-lg font-semibold tracking-[-0.02em] text-text">
                  {HOME_MESSAGES.comingSoonDialogTitle}
                </h2>
                <p id={descriptionId} className="text-sm leading-relaxed text-text-secondary">
                  {HOME_MESSAGES.comingSoonDialogBody}
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <Button
                ref={closeButtonRef}
                variant="primary"
                fullWidth
                onClick={() => setOpen(false)}
              >
                {HOME_MESSAGES.comingSoonDialogClose}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
