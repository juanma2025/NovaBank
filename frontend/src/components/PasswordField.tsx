import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, type Ref, useEffect, useId, useRef, useState } from 'react';

import { APP_MESSAGES } from '../lib/messages.ts';

export interface PasswordFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'type'
> {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  shakeKey?: number;
  ref?: Ref<HTMLInputElement>;
}

export function PasswordField({
  id: providedId,
  label,
  hint,
  error,
  shakeKey = 0,
  className = '',
  'aria-describedby': ariaDescribedBy,
  disabled,
  ref,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [shaking, setShaking] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, errorId, hintId].filter(Boolean).join(' ') || undefined;

  useEffect(() => {
    if (shakeKey <= 0 || !error) return;
    setShaking(false);
    void wrapRef.current?.offsetWidth;
    setShaking(true);
    const timer = setTimeout(() => setShaking(false), 260);
    return () => clearTimeout(timer);
  }, [error, shakeKey]);

  return (
    <div
      ref={wrapRef}
      className={`t-input-wrap flex flex-col gap-1.5 ${shaking ? 'is-shaking' : ''}`}
    >
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
          className={`t-input min-h-11 w-full rounded-[var(--radius-md)] border bg-surface py-2.5 pr-12 pl-3.5 text-[15px] text-text shadow-[var(--shadow-control)] placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-60 ${
            error
              ? 'is-error border-danger focus-visible:outline-danger'
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
          className="absolute right-0.5 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            aria-hidden="true"
            className="t-icon-swap h-[18px] w-[18px]"
            data-state={visible ? 'b' : 'a'}
          >
            <Eye className="t-icon h-[18px] w-[18px]" data-slot="a" />
            <EyeOff className="t-icon h-[18px] w-[18px]" data-slot="b" />
          </span>
        </button>
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
