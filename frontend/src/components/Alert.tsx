import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

export type AlertVariant = 'error' | 'warning' | 'success' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<AlertVariant, { container: string; icon: typeof Info }> = {
  error: {
    container: 'bg-danger-bg border-danger-border text-danger',
    icon: AlertCircle,
  },
  warning: {
    container: 'bg-warning-bg border-warning-border text-warning',
    icon: AlertTriangle,
  },
  success: {
    container: 'bg-success-bg border-success-border text-success',
    icon: CheckCircle2,
  },
  info: {
    container: 'bg-info-bg border-info-border text-info',
    icon: Info,
  },
};

export function Alert({ variant = 'info', title, children, action, className = '' }: AlertProps) {
  const { container, icon: Icon } = VARIANT_STYLES[variant];
  const isError = variant === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`nova-animate-enter flex items-start gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${container} ${className}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold leading-snug">{title}</p>}
        <div className="leading-relaxed">{children}</div>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}
