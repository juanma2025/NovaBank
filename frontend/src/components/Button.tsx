import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

import { Spinner } from './Spinner.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-active shadow-[var(--shadow-control)] border border-transparent',
  secondary:
    'bg-surface text-text hover:bg-surface-subtle active:bg-surface-subtle border border-border-strong shadow-[var(--shadow-control)]',
  ghost: 'bg-transparent text-brand-text hover:bg-brand-soft border border-transparent',
  danger:
    'bg-danger-bg text-danger border border-danger-border hover:opacity-90 shadow-[var(--shadow-control)]',
};

export function Button({
  variant = 'primary',
  loading = false,
  loadingLabel,
  fullWidth = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ref,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-[15px] font-semibold tracking-[-0.01em] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-55 ${VARIANT_CLASSES[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" decorative />}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}
