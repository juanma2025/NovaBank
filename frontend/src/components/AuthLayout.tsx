import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { APP_MESSAGES } from '../lib/messages.ts';
import { GlassCard } from './GlassCard.tsx';
import { NovaMark } from './NovaMark.tsx';

export interface AuthLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
}

export function AuthLayout({ children, footer, maxWidthClass = 'max-w-[440px]' }: AuthLayoutProps) {
  return (
    <div className="nova-canvas flex min-h-dvh flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div className={`w-full ${maxWidthClass} space-y-6`}>
        <header className="flex justify-center">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2.5 rounded-[var(--radius-md)] px-2 text-xl font-semibold tracking-[-0.02em] text-text transition-opacity duration-[var(--duration-quick)] hover:opacity-85"
          >
            <NovaMark className="h-8 w-8 shrink-0" />
            <span>{APP_MESSAGES.brandName}</span>
          </Link>
        </header>

        <main>
          <GlassCard className="nova-animate-enter">{children}</GlassCard>
        </main>

        {footer && <footer className="text-center text-sm text-text-secondary">{footer}</footer>}
      </div>
    </div>
  );
}
