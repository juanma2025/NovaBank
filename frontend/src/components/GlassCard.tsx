import type { HTMLAttributes, ReactNode } from 'react';

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassCard({ children, className = '', ...props }: GlassCardProps) {
  return (
    <div className={`nova-glass rounded-[var(--radius-xl)] p-6 sm:p-8 ${className}`} {...props}>
      {children}
    </div>
  );
}
