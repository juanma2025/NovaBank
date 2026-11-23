import { Link } from 'react-router';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { LearnMoreChevron } from '../../../components/LearnMoreChevron.tsx';
import { LANDING_MESSAGES } from '../../../lib/messages.ts';
import { FeaturesBento } from '../components/FeaturesBento.tsx';
import { PublicLayout } from '../components/PublicLayout.tsx';

export default function FeaturesPage() {
  const { features } = LANDING_MESSAGES;

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-16">
        <section className="t-stagger is-shown max-w-[64ch] space-y-3">
          <h1 className="t-stagger-line t-stagger-line--1 text-[2rem] leading-[1.1] font-semibold tracking-[-0.035em] text-text sm:text-[2.5rem]">
            {features.title}
          </h1>
          <p className="t-stagger-line t-stagger-line--2 text-base leading-relaxed text-text-secondary sm:text-lg">
            {features.subtitle}
          </p>
        </section>

        <section aria-label={features.title}>
          <GlassCard className="p-6 sm:p-8">
            <dl className="grid gap-6 sm:grid-cols-3">
              {features.highlights.map((item) => (
                <div key={item.metric} className="space-y-1.5">
                  <dt className="text-lg font-semibold tracking-[-0.02em] text-text">
                    {item.metric}
                  </dt>
                  <dd className="text-sm leading-relaxed text-text-secondary">{item.label}</dd>
                </div>
              ))}
            </dl>
          </GlassCard>
        </section>

        <section className="space-y-6">
          <div className="max-w-[60ch] space-y-2">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-text sm:text-2xl">
              {features.roadmapTitle}
            </h2>
            <p className="text-sm leading-relaxed text-text-secondary sm:text-[15px]">
              {features.roadmapSubtitle}
            </p>
          </div>

          <FeaturesBento />
        </section>

        <div className="flex justify-start border-t border-border pt-6">
          <Link
            to="/estudiantes"
            className="t-learn inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-sm font-semibold text-brand-text transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
          >
            <span>{features.nextRouteLabel}</span>
            <LearnMoreChevron />
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
