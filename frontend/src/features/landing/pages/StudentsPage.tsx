import { FileCheck2, GraduationCap, Lock, MailCheck } from 'lucide-react';
import { Link } from 'react-router';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { LearnMoreChevron } from '../../../components/LearnMoreChevron.tsx';
import { LANDING_MESSAGES } from '../../../lib/messages.ts';
import { PublicLayout } from '../components/PublicLayout.tsx';

const PILLAR_ICONS = [MailCheck, Lock, FileCheck2, GraduationCap] as const;

export default function StudentsPage() {
  const { students } = LANDING_MESSAGES;

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16">
        <section className="t-stagger is-shown max-w-[64ch] space-y-3">
          <h1 className="t-stagger-line t-stagger-line--1 text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] text-text sm:text-[2.5rem]">
            {students.title}
          </h1>
          <p className="t-stagger-line t-stagger-line--2 text-base leading-relaxed text-text-secondary sm:text-lg">
            {students.subtitle}
          </p>
        </section>

        <section aria-label={students.title}>
          <ul className="grid gap-5 md:grid-cols-2">
            {students.pillars.map((pillar, index) => {
              const Icon = PILLAR_ICONS[index] ?? Lock;
              return (
                <li key={pillar.title} className="h-full">
                  <GlassCard className="flex h-full flex-col justify-between gap-4 p-6">
                    <div className="space-y-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-soft text-brand-text">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <h2 className="text-lg font-semibold tracking-[-0.02em] text-text">
                        {pillar.title}
                      </h2>
                      <p className="text-sm leading-relaxed text-text-secondary">
                        {pillar.description}
                      </p>
                    </div>

                    {'linkLabel' in pillar && (
                      <div className="border-t border-border pt-3">
                        <Link
                          to="/privacidad"
                          className="t-learn inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-text underline transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
                        >
                          <span>{pillar.linkLabel}</span>
                          <LearnMoreChevron />
                        </Link>
                      </div>
                    )}
                  </GlassCard>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex justify-start border-t border-border pt-6">
          <Link
            to="/caracteristicas"
            className="t-learn inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-sm font-semibold text-brand-text transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
          >
            <span>{students.nextRouteLabel}</span>
            <LearnMoreChevron />
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
