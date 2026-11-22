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
        className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] py-1 text-sm text-text-secondary select-none"
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={errorId}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-border-strong accent-brand disabled:cursor-not-allowed"
        />
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
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
