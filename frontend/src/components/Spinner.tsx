import { Loader2 } from 'lucide-react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  decorative?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
};

export function Spinner({
  size = 'md',
  label = 'Cargando…',
  decorative = false,
  className = '',
}: SpinnerProps) {
  if (decorative) {
    return (
      <Loader2
        aria-hidden="true"
        className={`animate-spin shrink-0 ${SIZE_CLASSES[size]} ${className}`}
      />
    );
  }

  return (
    <span role="status" className="inline-flex items-center gap-2">
      <Loader2
        aria-hidden="true"
        className={`animate-spin shrink-0 ${SIZE_CLASSES[size]} ${className}`}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
