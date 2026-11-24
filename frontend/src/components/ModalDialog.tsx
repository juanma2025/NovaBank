import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalDialogProps {
  open: boolean;
  titleId: string;
  descriptionId?: string;
  maxWidthClass?: string;
  preventClose?: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Contenedor modal accesible reutilizable (WCAG 2.1 AA, transición `06-modal`).
 * Atrapa el foco con Tab/Shift+Tab, cierra con Escape y devuelve el foco al elemento previo.
 */
export function ModalDialog({
  open,
  titleId,
  descriptionId,
  maxWidthClass = 'max-w-md',
  preventClose = false,
  onClose,
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousActive =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousActive?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape' && !preventClose) {
      event.preventDefault();
      onClose();
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
      className="t-modal-backdrop is-open fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[var(--blur-overlay)]"
      onClick={(event) => {
        if (!preventClose && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        className={`nova-glass t-modal is-open w-full ${maxWidthClass} rounded-[var(--radius-xl)] p-5 sm:p-6`}
      >
        {children}
      </div>
    </div>
  );
}
