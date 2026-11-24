import { ShieldCheck } from 'lucide-react';

import { AppHeader } from '../../../components/AppHeader.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { WELCOME_MESSAGES } from '../../../lib/messages.ts';
import { useSession } from '../hooks/useSession.ts';

function extractFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : fullName;
}

export default function WelcomePage() {
  const { data: session, isPending } = useSession();

  return (
    <div className="nova-canvas flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <GlassCard className="nova-animate-enter w-full space-y-6">
          {isPending || !session ? (
            <div aria-busy="true" className="space-y-3">
              <div className="h-8 w-44 animate-pulse rounded-[var(--radius-sm)] bg-surface-subtle" />
              <div className="h-4 w-64 animate-pulse rounded-[var(--radius-sm)] bg-surface-subtle" />
            </div>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-success-border bg-success-bg px-3 py-1 text-xs font-medium text-success">
                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span>{WELCOME_MESSAGES.accountBadge}</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-[-0.025em] text-text">
                  {WELCOME_MESSAGES.greeting(extractFirstName(session.user.fullName))}
                </h1>
                <p className="text-base text-text-secondary">{WELCOME_MESSAGES.subtitle}</p>
              </div>

              <div className="rounded-[var(--radius-md)] border border-border bg-surface-subtle/70 px-4 py-3 text-sm text-text-secondary">
                <p className="font-medium text-text">{session.user.email}</p>
                <p className="mt-1">{WELCOME_MESSAGES.nextStepNote}</p>
              </div>
            </>
          )}
        </GlassCard>
      </main>
    </div>
  );
}
