import { GraduationCap, Layers } from 'lucide-react';
import { Link } from 'react-router';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { LearnMoreChevron } from '../../../components/LearnMoreChevron.tsx';
import { LANDING_MESSAGES } from '../../../lib/messages.ts';
import { HeroPreview } from '../components/HeroPreview.tsx';
import { PublicLayout } from '../components/PublicLayout.tsx';

export default function LandingPage() {
  const { home } = LANDING_MESSAGES;
  const { gateways } = home;

  return (
    <PublicLayout>
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-16">
          <div className="t-stagger is-shown space-y-6">
            <h1 className="t-stagger-line t-stagger-line--1 text-[2rem] leading-[1.08] font-semibold tracking-[-0.035em] text-text sm:text-[2.75rem] lg:text-[3.25rem]">
              {home.headline}
            </h1>

            <p className="t-stagger-line t-stagger-line--2 max-w-[52ch] text-base leading-relaxed text-text-secondary sm:text-lg">
              {home.subtitle}
            </p>

            <div className="t-stagger-line t-stagger-line--3 grid gap-3.5 pt-2 sm:grid-cols-2">
              <Link
                to="/caracteristicas"
                className="t-learn group block rounded-[var(--radius-xl)] focus-visible:outline-2"
              >
                <GlassCard className="flex h-full flex-col justify-between gap-4 p-5 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-hover:-translate-y-0.5">
                  <div className="space-y-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-soft text-brand-text">
                      <Layers aria-hidden="true" className="h-[18px] w-[18px]" />
                    </span>
                    <h2 className="text-base font-semibold tracking-[-0.02em] text-text">
                      {gateways.featuresTitle}
                    </h2>
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {gateways.featuresSummary}
                    </p>
                  </div>
                  <span className="inline-flex min-h-6 items-center gap-1 text-sm font-semibold text-brand-text">
                    <span>{gateways.featuresAction}</span>
                    <LearnMoreChevron />
                  </span>
                </GlassCard>
              </Link>

              <Link
                to="/estudiantes"
                className="t-learn group block rounded-[var(--radius-xl)] focus-visible:outline-2"
              >
                <GlassCard className="flex h-full flex-col justify-between gap-4 p-5 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-hover:-translate-y-0.5">
                  <div className="space-y-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-violet/12 text-brand-violet">
                      <GraduationCap aria-hidden="true" className="h-[18px] w-[18px]" />
                    </span>
                    <h2 className="text-base font-semibold tracking-[-0.02em] text-text">
                      {gateways.studentsTitle}
                    </h2>
                    <p className="text-sm leading-relaxed text-text-secondary">
                      {gateways.studentsSummary}
                    </p>
                  </div>
                  <span className="inline-flex min-h-6 items-center gap-1 text-sm font-semibold text-brand-text">
                    <span>{gateways.studentsAction}</span>
                    <LearnMoreChevron />
                  </span>
                </GlassCard>
              </Link>
            </div>
          </div>

          <HeroPreview />
        </div>
      </section>
    </PublicLayout>
  );
}
