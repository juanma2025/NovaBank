import { AlertCircle } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';

import { REGISTER_MESSAGES } from '../../../lib/messages.ts';

export interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  disabled?: boolean;
}

export function ConsentCheckbox({
  checked,
  onChange,
  error,
  disabled = false,
}: ConsentCheckboxProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className={`relative flex min-h-11 items-start gap-3 rounded-[var(--radius-sm)] py-1 text-sm text-text-secondary select-none ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={errorId}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          data-checked={checked ? 'true' : 'false'}
          data-error={error ? 'true' : undefined}
          className="t-check mt-0.5 shrink-0 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring"
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
            <path
              d="M3.2 8.4L6.5 11.7L12.8 4.8"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="leading-relaxed">
          {REGISTER_MESSAGES.consentPrefix}
          <Link
            to="/privacidad"
            className="font-medium text-brand-text underline transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
          >
            {REGISTER_MESSAGES.consentLink}
          </Link>
          {REGISTER_MESSAGES.consentSuffix}
        </span>
      </label>

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
    </div>
  );
}
