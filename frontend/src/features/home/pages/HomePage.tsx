import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { APP_MESSAGES, HOME_MESSAGES } from '../../../lib/messages.ts';
import { useAccount } from '../../accounts/hooks/useAccount.ts';
import { useBalanceVisibility } from '../../accounts/hooks/useBalanceVisibility.ts';
import { useSession } from '../../auth/hooks/useSession.ts';
import { BalanceCard } from '../components/BalanceCard.tsx';
import { BudgetAlertBanner } from '../components/BudgetAlertBanner.tsx';
import { ComingSoonCard } from '../components/ComingSoonCard.tsx';
import { EmptyMovements } from '../components/EmptyMovements.tsx';
import { MovementList } from '../components/MovementList.tsx';

function extractFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : fullName;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <GlassCard className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-5 w-36 rounded-[var(--radius-sm)] bg-surface-subtle" />
          <div className="h-11 w-28 rounded-[var(--radius-md)] bg-surface-subtle" />
        </div>
        <div className="h-11 w-52 max-w-full rounded-[var(--radius-sm)] bg-surface-subtle" />
        <div className="border-t border-border pt-4">
          <div className="h-11 w-36 rounded-[var(--radius-md)] bg-surface-subtle" />
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="h-5 w-40 rounded-[var(--radius-sm)] bg-surface-subtle" />
        <div className="divide-y divide-border">
          {[1, 2, 3].map((row) => (
            <div key={row} className="flex items-center justify-between gap-3 py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-[var(--radius-md)] bg-surface-subtle" />
                <div className="space-y-2">
                  <div className="h-4 w-36 rounded-[var(--radius-sm)] bg-surface-subtle" />
                  <div className="h-3 w-24 rounded-[var(--radius-sm)] bg-surface-subtle" />
                </div>
              </div>
              <div className="h-4 w-20 rounded-[var(--radius-sm)] bg-surface-subtle" />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

export default function HomePage() {
  const { data: session } = useSession();
  const accountQuery = useAccount();
  const { hidden, toggle } = useBalanceVisibility();

  const greetingName = session ? extractFirstName(session.user.fullName) : '';
  const account = accountQuery.data;
  const isRevealed = !accountQuery.isPending && Boolean(account);

  return (
    <AppShell>
      <div className="space-y-6 lg:space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
            {greetingName ? HOME_MESSAGES.greeting(greetingName) : APP_MESSAGES.brandName}
          </h1>
          <p className="text-sm leading-relaxed text-text-secondary">{HOME_MESSAGES.subtitle}</p>
        </div>

        <BudgetAlertBanner />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">
            {accountQuery.isError ? (
              <GlassCard>
                <Alert
                  variant="error"
                  action={
                    <Button
                      variant="secondary"
                      loading={accountQuery.isFetching}
                      onClick={() => {
                        void accountQuery.refetch();
                      }}
                    >
                      {APP_MESSAGES.retry}
                    </Button>
                  }
                >
                  {accountQuery.error.message || HOME_MESSAGES.loadError}
                </Alert>
              </GlassCard>
            ) : (
              <div className={`t-skel ${isRevealed ? 'is-revealed' : ''}`}>
                <div
                  aria-hidden={isRevealed || undefined}
                  aria-busy={!isRevealed || undefined}
                  className="t-skel-skeleton"
                >
                  <DashboardSkeleton />
                </div>

                <div aria-hidden={!isRevealed || undefined} className="t-skel-content space-y-6">
                  {account && (
                    <>
                      <BalanceCard
                        balance={account.balance}
                        hidden={hidden}
                        onToggleHidden={toggle}
                      />

                      <GlassCard className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
                            {HOME_MESSAGES.recentMovementsTitle}
                          </h2>
                          {account.recentMovements.length > 0 && (
                            <Link
                              to="/movimientos"
                              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-brand-text transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
                            >
                              <span>{HOME_MESSAGES.viewAllMovements}</span>
                              <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                            </Link>
                          )}
                        </div>

                        {account.recentMovements.length === 0 ? (
                          <EmptyMovements />
                        ) : (
                          <MovementList movements={account.recentMovements} hideAmounts={hidden} />
                        )}
                      </GlassCard>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <ComingSoonCard />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
