import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, type Ref, useId, useState } from 'react';

import { APP_MESSAGES } from '../lib/messages.ts';

export interface PasswordFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function PasswordField({
  id: providedId,
  label,
  hint,
  error,
  className = '',
  'aria-describedby': ariaDescribedBy,
  disabled,
  ref,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
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
      <div className="relative flex items-center">
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={`min-h-11 w-full rounded-[var(--radius-md)] border bg-surface py-2.5 pl-3.5 pr-12 text-[15px] text-text placeholder:text-text-muted shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] disabled:cursor-not-allowed disabled:opacity-60 ${
            error
              ? 'border-danger focus-visible:outline-danger'
              : 'border-border-strong hover:border-text-muted focus-visible:border-brand'
          } ${className}`}
          {...props}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? APP_MESSAGES.hidePassword : APP_MESSAGES.showPassword}
          aria-pressed={visible}
          className="absolute right-0.5 inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="h-[18px] w-[18px]" />
          ) : (
            <Eye aria-hidden="true" className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
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
