import { Lock, MailCheck, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { APP_MESSAGES, AUTH_EDITORIAL_MESSAGES } from '../lib/messages.ts';
import { GlassCard } from './GlassCard.tsx';
import { NovaMark } from './NovaMark.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

export interface AuthLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  layout?: 'split' | 'centered';
}

const SIGNAL_ICONS = [MailCheck, Lock, ShieldCheck] as const;

export function AuthLayout({
  children,
  footer,
  maxWidthClass = 'max-w-[440px]',
  layout = 'split',
}: AuthLayoutProps) {
  if (layout === 'centered') {
    return (
      <div className="nova-canvas flex min-h-dvh flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className={`w-full ${maxWidthClass} space-y-6`}>
          <header className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-2.5 rounded-[var(--radius-md)] pr-2 text-xl font-semibold tracking-[-0.02em] text-text transition-opacity duration-[var(--duration-quick)] hover:opacity-85"
            >
              <NovaMark className="h-8 w-8 shrink-0" />
              <span>{APP_MESSAGES.brandName}</span>
            </Link>
            <ThemeToggle />
          </header>

          <main>
            <GlassCard className="t-surface-enter">{children}</GlassCard>
          </main>

          {footer && <footer className="text-center text-sm text-text-secondary">{footer}</footer>}
        </div>
      </div>
    );
  }

  return (
    <div className="nova-canvas flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-6 sm:px-6 lg:px-10 lg:pt-8">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2.5 rounded-[var(--radius-md)] pr-2 text-xl font-semibold tracking-[-0.02em] text-text transition-opacity duration-[var(--duration-quick)] hover:opacity-85"
        >
          <NovaMark className="h-8 w-8 shrink-0" />
          <span>{APP_MESSAGES.brandName}</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs font-medium text-text-muted sm:inline">
            {APP_MESSAGES.brandTagline}
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16">
          <div className="hidden max-w-lg flex-col justify-center space-y-8 lg:flex">
            <div className="space-y-3">
              <h2 className="text-[2rem] leading-[1.15] font-semibold tracking-[-0.03em] text-text">
                {AUTH_EDITORIAL_MESSAGES.headline}
              </h2>
              <p className="text-[15px] leading-relaxed text-text-secondary">
                {AUTH_EDITORIAL_MESSAGES.description}
              </p>
            </div>

            <ul className="space-y-5 border-t border-border pt-6">
              {AUTH_EDITORIAL_MESSAGES.signals.map((signal, index) => {
                const Icon = SIGNAL_ICONS[index] ?? ShieldCheck;
                return (
                  <li key={signal.title} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface/80 text-brand-text shadow-[var(--shadow-control)]">
                      <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-text">{signal.title}</p>
                      <p className="text-sm leading-relaxed text-text-secondary">{signal.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="border-t border-border pt-5 text-xs leading-relaxed text-text-muted">
              {AUTH_EDITORIAL_MESSAGES.academicNotice}
            </p>
          </div>

          <div className={`mx-auto w-full ${maxWidthClass} lg:mx-0`}>
            <GlassCard className="t-surface-enter">{children}</GlassCard>
          </div>
        </div>
      </main>

      {footer && (
        <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-center text-sm text-text-secondary sm:px-6 lg:px-10">
          <div className={`mx-auto w-full ${maxWidthClass} lg:mr-0 lg:ml-auto`}>{footer}</div>
        </footer>
      )}
    </div>
  );
}
