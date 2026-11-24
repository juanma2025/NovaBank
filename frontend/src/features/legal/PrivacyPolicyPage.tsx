import { PRIVACY_POLICY_VERSION } from '@nova/shared';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';

import { AuthLayout } from '../../components/AuthLayout.tsx';
import { PRIVACY_POLICY_MESSAGES } from '../../lib/messages.ts';

export default function PrivacyPolicyPage() {
  return (
    <AuthLayout layout="centered" maxWidthClass="max-w-2xl">
      <article className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-text sm:text-[1.75rem]">
            {PRIVACY_POLICY_MESSAGES.title}
          </h1>
          <div className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-info-border bg-info-bg px-3 py-1 text-xs font-medium text-info">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="tabular-nums">
              {PRIVACY_POLICY_MESSAGES.versionLabel(PRIVACY_POLICY_VERSION)}
            </span>
          </div>
          <p className="max-w-[65ch] text-sm leading-relaxed text-text-secondary">
            {PRIVACY_POLICY_MESSAGES.intro}
          </p>
        </div>

        <div className="divide-y divide-border border-t border-border">
          {PRIVACY_POLICY_MESSAGES.sections.map((section) => (
            <section key={section.heading} className="space-y-1.5 py-5 first:pt-5 last:pb-0">
              <h2 className="text-base font-semibold tracking-[-0.01em] text-text">
                {section.heading}
              </h2>
              <p className="max-w-[65ch] text-sm leading-relaxed text-text-secondary">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <div className="border-t border-border pt-5">
          <Link
            to="/registro"
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{PRIVACY_POLICY_MESSAGES.backToRegister}</span>
          </Link>
        </div>
      </article>
    </AuthLayout>
  );
}
