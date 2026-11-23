import { ArrowLeft, User } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { Alert } from '../../../components/Alert.tsx';
import { AppShell } from '../../../components/AppShell.tsx';
import { Button } from '../../../components/Button.tsx';
import { GlassCard } from '../../../components/GlassCard.tsx';
import { SuccessCheck } from '../../../components/SuccessCheck.tsx';
import { APP_MESSAGES, PROFILE_MESSAGES } from '../../../lib/messages.ts';
import { AliasSection } from '../components/AliasSection.tsx';
import { useProfile } from '../hooks/useProfile.ts';

export default function ProfilePage() {
  const profileQuery = useProfile();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const profile = profileQuery.data;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="space-y-3">
          <Link
            to="/inicio"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] pr-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{PROFILE_MESSAGES.backToHome}</span>
          </Link>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-[1.875rem]">
              {PROFILE_MESSAGES.pageTitle}
            </h1>
            <p className="text-sm leading-relaxed text-text-secondary">
              {PROFILE_MESSAGES.pageSubtitle}
            </p>
          </div>
        </div>

        {toastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="t-toast is-open flex items-center gap-3 rounded-[var(--radius-md)] border border-success-border bg-success-bg px-4 py-3 text-sm font-medium text-success"
          >
            <SuccessCheck className="h-[18px] w-[18px] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {profileQuery.isError ? (
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button
                  variant="secondary"
                  loading={profileQuery.isFetching}
                  onClick={() => void profileQuery.refetch()}
                >
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {profileQuery.error.message || PROFILE_MESSAGES.loadError}
            </Alert>
          </GlassCard>
        ) : profileQuery.isPending || !profile ? (
          <GlassCard className="space-y-4">
            <div className="h-5 w-40 rounded-[var(--radius-sm)] bg-surface-subtle" />
            <div className="h-4 w-56 rounded-[var(--radius-sm)] bg-surface-subtle" />
            <div className="h-11 w-full rounded-[var(--radius-md)] bg-surface-subtle" />
          </GlassCard>
        ) : (
          <div className="space-y-6">
            <GlassCard className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-soft text-brand-text">
                  <User aria-hidden="true" className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
                  {PROFILE_MESSAGES.accountCardTitle}
                </h2>
              </div>

              <dl className="divide-y divide-border text-sm">
                <div className="flex flex-col gap-0.5 py-3 first:pt-1 sm:flex-row sm:justify-between">
                  <dt className="text-text-secondary">{PROFILE_MESSAGES.fullNameLabel}</dt>
                  <dd className="font-medium text-text">{profile.fullName}</dd>
                </div>
                <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:justify-between">
                  <dt className="text-text-secondary">{PROFILE_MESSAGES.emailLabel}</dt>
                  <dd className="font-medium text-text">{profile.email}</dd>
                </div>
                <div className="flex flex-col gap-1 py-3 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <dt className="text-text-secondary">{PROFILE_MESSAGES.currentAliasLabel}</dt>
                  <dd>
                    {profile.alias ? (
                      <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-border bg-brand-soft px-3 py-0.5 text-xs font-semibold text-brand-text">
                        @{profile.alias}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-text-muted">
                        {PROFILE_MESSAGES.noAliasBadge}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </GlassCard>

            <AliasSection currentAlias={profile.alias} onStatusMessage={setToastMessage} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
