import { parseCOPInput } from '@nova/shared';
import { AlertCircle } from 'lucide-react';
import { type ChangeEvent, useEffect, useId, useRef, useState } from 'react';

export interface AmountInputProps {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  shakeKey?: number;
  onValueChange: (parsedAmount: number | null, formattedRaw: string) => void;
  onBlur?: () => void;
}

const integerFormatter = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatCOPDigits(amount: number): string {
  return integerFormatter.format(amount);
}

/**
 * Interpreta y formatea montos en pesos colombianos enteros mientras se escribe.
 * Acepta «50000», «50.000» y «$50.000» usando `parseCOPInput` de `@nova/shared`.
 */
function parseAndFormatInput(raw: string): { parsed: number | null; display: string } {
  const trimmed = raw.trim();
  if (trimmed === '') return { parsed: null, display: '' };

  const directParsed = parseCOPInput(trimmed);
  if (directParsed !== null) {
    return {
      parsed: directParsed > 0 ? directParsed : null,
      display: directParsed > 0 ? formatCOPDigits(directParsed) : trimmed,
    };
  }

  // Mientras el usuario edita (ej. borra un dígito y queda «50.00»), normaliza si solo hay dígitos, puntos, espacios o $.
  const stripped = trimmed.replace(/^\$/, '').replace(/\s/g, '');
  if (/^[\d.]+$/.test(stripped) && !/^\.|\.\.|\.$/.test(stripped)) {
    const digitsOnly = stripped.replaceAll('.', '');
    const parsedFromDigits = parseCOPInput(digitsOnly);
    if (parsedFromDigits !== null && parsedFromDigits > 0) {
      return {
        parsed: parsedFromDigits,
        display: formatCOPDigits(parsedFromDigits),
      };
    }
  }

  return { parsed: null, display: raw };
}

export function AmountInput({
  id: providedId,
  label,
  value,
  placeholder = '50.000',
  hint,
  error,
  disabled = false,
  shakeKey = 0,
  onValueChange,
  onBlur,
}: AmountInputProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (shakeKey <= 0 || !error) return;
    setShaking(false);
    void wrapRef.current?.offsetWidth;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 260);
    return () => clearTimeout(timer);
  }, [error, shakeKey]);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const { parsed, display } = parseAndFormatInput(event.target.value);
    onValueChange(parsed, display);
  }

  return (
    <div
      ref={wrapRef}
      className={`t-input-wrap flex flex-col gap-1.5 ${shaking ? 'is-shaking' : ''}`}
    >
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>

      <div className="relative flex items-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 text-lg font-semibold text-text-muted"
        >
          $
        </span>
        <input
          id={id}
          name="amount"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          onChange={handleChange}
          onBlur={onBlur}
          className={`t-input min-h-12 w-full rounded-[var(--radius-md)] border bg-surface py-3 pr-16 pl-9 text-xl font-semibold tracking-[-0.02em] text-text tabular-nums shadow-[var(--shadow-control)] placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-60 ${
            error
              ? 'is-error border-danger focus-visible:outline-danger'
              : 'border-border-strong hover:border-text-muted focus-visible:border-brand'
          }`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-text-secondary"
        >
          COP
        </span>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="t-error-msg flex items-start gap-1.5 text-sm text-danger"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
