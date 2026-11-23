import { FileCheck2, GraduationCap, Lock, MailCheck } from 'lucide-react';
import { Link } from 'react-router';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { LearnMoreChevron } from '../../../components/LearnMoreChevron.tsx';
import { NovaMark } from '../../../components/NovaMark.tsx';
import { ThemeToggle } from '../../../components/ThemeToggle.tsx';
import { APP_MESSAGES, LANDING_MESSAGES } from '../../../lib/messages.ts';
import { FeaturesBento } from '../components/FeaturesBento.tsx';
import { HeroPreview } from '../components/HeroPreview.tsx';

const PILLAR_ICONS = [MailCheck, FileCheck2, Lock, GraduationCap] as const;

export default function LandingPage() {
  const { nav, hero, whatIs, features, audience, closing, footer } = LANDING_MESSAGES;

  return (
    <div className="nova-canvas flex min-h-dvh flex-col">
      {/* Barra superior fija de vidrio esmerilado (360 px → escritorio sin desborde) */}
      <header className="nova-glass-header sticky top-0 z-30 w-full">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-10">
          <Link
            to="/"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-sm)] pr-1 text-base font-semibold tracking-[-0.02em] text-text transition-opacity duration-[var(--duration-quick)] hover:opacity-85 sm:gap-2.5 sm:text-lg"
          >
            <NovaMark className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
            <span>{APP_MESSAGES.brandName}</span>
          </Link>

          <nav aria-label={nav.ariaLabel} className="hidden items-center gap-1 md:flex">
            <a
              href="#que-es"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-3.5 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle hover:text-text"
            >
              {nav.whatIs}
            </a>
            <a
              href="#caracteristicas"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-3.5 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle hover:text-text"
            >
              {nav.features}
            </a>
            <a
              href="#para-estudiantes"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] px-3.5 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle hover:text-text"
            >
              {nav.forStudents}
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <ThemeToggle />
            <Link
              to="/ingresar"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface/85 px-2.5 text-xs font-semibold text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle sm:px-4 sm:text-sm"
            >
              {nav.login}
            </Link>
            <Link
              to="/registro"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-brand px-2.5 text-xs font-semibold text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-brand-hover active:bg-brand-active sm:px-4 sm:text-sm"
            >
              {nav.register}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero principal */}
        <section className="mx-auto w-full max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16 sm:pb-24 lg:px-10 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-16">
            <div className="t-stagger is-shown space-y-6">
              <h1 className="t-stagger-line t-stagger-line--1 text-[2rem] leading-[1.08] font-semibold tracking-[-0.035em] text-text sm:text-[2.75rem] lg:text-[3.25rem]">
                {hero.headline}
              </h1>

              <p className="t-stagger-line t-stagger-line--2 max-w-[56ch] text-base leading-relaxed text-text-secondary sm:text-lg">
                {hero.subtitle}
              </p>

              <div className="t-stagger-line t-stagger-line--3 flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <Link
                  to="/registro"
                  className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-brand px-6 py-3 text-[15px] font-semibold tracking-[-0.01em] text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-brand-hover active:bg-brand-active"
                >
                  {hero.primaryCta}
                </Link>
                <Link
                  to="/ingresar"
                  className="t-learn inline-flex min-h-12 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border-strong bg-surface/90 px-6 py-3 text-[15px] font-semibold text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle"
                >
                  <span>{hero.secondaryCta}</span>
                  <LearnMoreChevron />
                </Link>
              </div>
            </div>

            <HeroPreview />
          </div>
        </section>

        {/* Qué hace Nova */}
        <section
          id="que-es"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:px-10"
        >
          <GlassCard className="space-y-8">
            <div className="max-w-[65ch] space-y-3">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-3xl">
                {whatIs.title}
              </h2>
              <p className="text-[15px] leading-relaxed text-text-secondary sm:text-base">
                {whatIs.description}
              </p>
            </div>

            <dl className="grid gap-6 border-t border-border pt-6 sm:grid-cols-3">
              {whatIs.highlights.map((item) => (
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

        {/* Bento Grid de características */}
        <section
          id="caracteristicas"
          className="mx-auto w-full max-w-6xl scroll-mt-20 space-y-8 px-4 py-14 sm:px-6 lg:px-10"
        >
          <div className="max-w-[60ch] space-y-2.5">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-3xl">
              {features.title}
            </h2>
            <p className="text-[15px] leading-relaxed text-text-secondary sm:text-base">
              {features.subtitle}
            </p>
          </div>

          <FeaturesBento />
        </section>

        {/* Para estudiantes y pilares de confianza */}
        <section
          id="para-estudiantes"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:px-10"
        >
          <GlassCard className="space-y-8">
            <div className="max-w-[65ch] space-y-2.5">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-text sm:text-3xl">
                {audience.title}
              </h2>
              <p className="text-[15px] leading-relaxed text-text-secondary sm:text-base">
                {audience.subtitle}
              </p>
            </div>

            <ul className="grid gap-6 border-t border-border pt-6 md:grid-cols-2">
              {audience.pillars.map((pillar, index) => {
                const Icon = PILLAR_ICONS[index] ?? Lock;
                return (
                  <li key={pillar.title} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface-subtle text-brand-text">
                      <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-base font-semibold text-text">{pillar.title}</h3>
                      <p className="text-sm leading-relaxed text-text-secondary">
                        {pillar.description}
                      </p>
                      {'linkLabel' in pillar && (
                        <Link
                          to="/privacidad"
                          className="t-learn inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-text underline transition-opacity duration-[var(--duration-quick)] hover:opacity-80"
                        >
                          <span>{pillar.linkLabel}</span>
                          <LearnMoreChevron />
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        </section>

        {/* Cierre con acciones principales */}
        <section className="mx-auto w-full max-w-6xl px-4 pt-6 pb-20 sm:px-6 lg:px-10">
          <GlassCard className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-[54ch] space-y-1.5">
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-text sm:text-2xl">
                {closing.title}
              </h2>
              <p className="text-sm leading-relaxed text-text-secondary sm:text-[15px]">
                {closing.description}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link
                to="/registro"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-brand px-5 py-2.5 text-[15px] font-semibold text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-brand-hover active:bg-brand-active"
              >
                {closing.primaryCta}
              </Link>
              <Link
                to="/ingresar"
                className="t-learn inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-border-strong bg-surface px-5 py-2.5 text-[15px] font-semibold text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle"
              >
                <span>{closing.secondaryCta}</span>
                <LearnMoreChevron />
              </Link>
            </div>
          </GlassCard>
        </section>
      </main>

      {/* Footer minimalista */}
      <footer className="border-t border-border bg-surface-glass-strong/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-base font-semibold tracking-[-0.02em] text-text">
              <NovaMark className="h-6 w-6 shrink-0" />
              <span>{APP_MESSAGES.brandName}</span>
            </div>
            <p className="text-xs leading-relaxed text-text-muted">{footer.academicNote}</p>
          </div>

          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <Link
              to="/ingresar"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
            >
              {nav.login}
            </Link>
            <Link
              to="/registro"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
            >
              {nav.register}
            </Link>
            <Link
              to="/privacidad"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text"
            >
              {footer.privacy}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
