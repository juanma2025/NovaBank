import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { SuccessCheck } from './SuccessCheck.tsx';

export type AlertVariant = 'error' | 'warning' | 'success' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: 'bg-danger-bg border-danger-border text-danger',
  warning: 'bg-warning-bg border-warning-border text-warning',
  success: 'bg-success-bg border-success-border text-success',
  info: 'bg-info-bg border-info-border text-info',
};

function AlertIcon({ variant }: { variant: AlertVariant }) {
  if (variant === 'success') {
    return <SuccessCheck className="mt-0.5 h-[18px] w-[18px] shrink-0" />;
  }
  if (variant === 'error') {
    return <AlertCircle aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />;
  }
  if (variant === 'warning') {
    return <AlertTriangle aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />;
  }
  return <Info aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />;
}

export function Alert({ variant = 'info', title, children, action, className = '' }: AlertProps) {
  const isError = variant === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`t-surface-enter flex items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${VARIANT_CLASSES[variant]} ${className}`}
    >
      <AlertIcon variant={variant} />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="leading-snug font-semibold">{title}</p>}
        <div className="leading-relaxed">{children}</div>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}
