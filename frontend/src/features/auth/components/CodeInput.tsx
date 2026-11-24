import { CODE_LENGTH } from '@nova/shared';
import { AlertCircle } from 'lucide-react';
import { type ClipboardEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';

import { VERIFICATION_MESSAGES } from '../../../lib/messages.ts';

export interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  error?: string;
  errorKey?: number;
}

const SLOTS = Array.from({ length: CODE_LENGTH }, (_, i) => i);

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  error,
  errorKey = 0,
}: CodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const lastSubmittedRef = useRef<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const groupId = useId();
  const errorId = error ? `${groupId}-error` : undefined;

  useEffect(() => {
    if (errorKey <= 0) return;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 350);
    return () => clearTimeout(timer);
  }, [errorKey]);

  const digits = SLOTS.map((index) => value[index] ?? '');

  function focusSlot(index: number): void {
    const clamped = Math.max(0, Math.min(CODE_LENGTH - 1, index));
    inputRefs.current[clamped]?.focus();
  }

  function commitValue(nextRaw: string, nextFocusIndex?: number): void {
    const cleaned = digitsOnly(nextRaw);
    if (cleaned.length < CODE_LENGTH) {
      lastSubmittedRef.current = null;
    }
    onChange(cleaned);

    if (nextFocusIndex !== undefined) {
      focusSlot(nextFocusIndex);
    }

    if (
      cleaned.length === CODE_LENGTH &&
      !disabled &&
      onComplete &&
      lastSubmittedRef.current !== cleaned
    ) {
      lastSubmittedRef.current = cleaned;
      onComplete(cleaned);
    }
  }

  function handleChange(index: number, rawInput: string): void {
    const cleaned = digitsOnly(rawInput);
    if (cleaned.length > 1) {
      const targetIndex = Math.min(cleaned.length - 1, CODE_LENGTH - 1);
      commitValue(cleaned, targetIndex);
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = cleaned;
    const joined = nextDigits.join('');
    commitValue(joined, cleaned ? Math.min(index + 1, CODE_LENGTH - 1) : index);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Backspace') {
      if (digits[index]) {
        event.preventDefault();
        const nextDigits = [...digits];
        nextDigits[index] = '';
        commitValue(nextDigits.join(''), index);
      } else if (index > 0) {
        event.preventDefault();
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        commitValue(nextDigits.join(''), index - 1);
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusSlot(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusSlot(index + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusSlot(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusSlot(CODE_LENGTH - 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>): void {
    const pasted = digitsOnly(event.clipboardData.getData('text'));
    if (!pasted) return;
    event.preventDefault();
    const targetIndex = Math.min(pasted.length - 1, CODE_LENGTH - 1);
    commitValue(pasted, targetIndex);
  }

  return (
    <fieldset className="m-0 border-0 p-0" aria-describedby={errorId}>
      <legend className="mb-2 text-sm font-medium text-text">
        {VERIFICATION_MESSAGES.codeLabel}
      </legend>

      <div className={`grid grid-cols-6 gap-1 sm:gap-2 ${shaking ? 'nova-animate-shake' : ''}`}>
        {SLOTS.map((index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={CODE_LENGTH}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            value={digits[index] ?? ''}
            disabled={disabled}
            aria-label={VERIFICATION_MESSAGES.codeDigitLabel(index)}
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.currentTarget.select()}
            className={`h-12 min-h-11 w-full min-w-0 rounded-[var(--radius-md)] border bg-surface text-center text-lg font-semibold tabular-nums text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] disabled:cursor-not-allowed disabled:opacity-60 ${
              error
                ? 'border-danger focus-visible:outline-danger'
                : 'border-border-strong hover:border-text-muted focus-visible:border-brand'
            }`}
          />
        ))}
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="mt-2.5 flex items-start gap-1.5 text-sm text-danger"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
