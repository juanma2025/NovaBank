import { AlertCircle } from 'lucide-react';
import { type InputHTMLAttributes, type Ref, useId } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  id: providedId,
  label,
  hint,
  error,
  className = '',
  'aria-describedby': ariaDescribedBy,
  ref,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        className={`min-h-11 w-full rounded-[var(--radius-md)] border bg-surface px-3.5 py-2.5 text-[15px] text-text placeholder:text-text-muted shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] disabled:cursor-not-allowed disabled:opacity-60 ${
          error
            ? 'border-danger focus-visible:outline-danger'
            : 'border-border-strong hover:border-text-muted focus-visible:border-brand'
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
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
