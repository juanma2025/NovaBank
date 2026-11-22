import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { APP_MESSAGES } from '../lib/messages.ts';

export interface AppHeaderProps {
  actions?: ReactNode;
}

export function NovaMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={className}>
      <rect width="32" height="32" rx="9" fill="currentColor" className="text-brand" />
      <path
        d="M10 22V10h2.6l6.8 8.3V10H22v12h-2.6l-6.8-8.3V22H10Z"
        fill="currentColor"
        className="text-on-brand"
      />
    </svg>
  );
}

export function AppHeader({ actions }: AppHeaderProps) {
  return (
    <header className="nova-glass-header sticky top-0 z-20 w-full">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] pr-2 text-lg font-semibold tracking-[-0.02em] text-text transition-opacity duration-[var(--duration-quick)] hover:opacity-85"
        >
          <NovaMark className="h-7 w-7 shrink-0" />
          <span>{APP_MESSAGES.brandName}</span>
        </Link>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
