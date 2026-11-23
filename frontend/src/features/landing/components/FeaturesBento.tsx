import { formatCOP } from '@nova/shared';
import { ArrowLeftRight, Coins, CreditCard, EyeOff, PiggyBank, Users, Wallet } from 'lucide-react';

import { TiltCard } from '../../../components/TiltCard.tsx';
import { LANDING_MESSAGES } from '../../../lib/messages.ts';

/** Bento Grid adaptativo de características reales de Nova (1 col desde 360 px → 6 cols en lg). */
export function FeaturesBento() {
  const { cards } = LANDING_MESSAGES.features;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-6">
      {/* 1. Cuenta en COP y libro contable */}
      <TiltCard
        className="t-surface-enter md:col-span-2 lg:col-span-4"
        maxTiltDeg={4}
        cardClassName="flex h-full flex-col justify-between gap-6 p-6"
      >
        <div className="space-y-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-soft text-brand-text">
            <Wallet aria-hidden="true" className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-text">
            {cards.copAccount.title}
          </h3>
          <p className="max-w-[58ch] text-sm leading-relaxed text-text-secondary">
            {cards.copAccount.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs font-medium">
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-success-border bg-success-bg px-3 py-1 text-success tabular-nums">
            +{formatCOP(50_000)} · {cards.copAccount.chipSecondary}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-3 py-1 text-text-secondary">
            <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
            <span>{cards.copAccount.chipPrimary}</span>
          </span>
        </div>
      </TiltCard>

      {/* 2. Transferencias entre compañeros */}
      <TiltCard
        className="t-surface-enter lg:col-span-2"
        maxTiltDeg={4}
        cardClassName="flex h-full flex-col justify-between gap-6 p-6"
      >
        <div className="space-y-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-soft text-brand-text">
            <ArrowLeftRight aria-hidden="true" className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-text">
            {cards.transfers.title}
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">
            {cards.transfers.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs font-medium">
          <span className="rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-3 py-1 text-text">
            {cards.transfers.chipAlias}
          </span>
          <span className="rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-3 py-1 text-text-muted">
            {cards.transfers.chipDomain}
          </span>
        </div>
      </TiltCard>

      {/* 3. Tarjeta virtual simulada */}
      <TiltCard
        className="t-surface-enter lg:col-span-3"
        maxTiltDeg={4}
        cardClassName="flex h-full flex-col justify-between gap-6 p-6"
      >
        <div className="space-y-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-soft text-brand-text">
            <CreditCard aria-hidden="true" className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-text">
            {cards.virtualCard.title}
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">
            {cards.virtualCard.description}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4 text-xs font-medium">
          <span className="text-text tabular-nums">{cards.virtualCard.chipDigits}</span>
          <span className="rounded-[var(--radius-pill)] border border-info-border bg-info-bg px-3 py-1 text-info">
            {cards.virtualCard.chipStatus}
          </span>
        </div>
      </TiltCard>

      {/* 4. Metas de ahorro y presupuestos */}
      <TiltCard
        className="t-surface-enter lg:col-span-3"
        maxTiltDeg={4}
        cardClassName="flex h-full flex-col justify-between gap-6 p-6"
      >
        <div className="space-y-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-border bg-success-bg text-success">
            <PiggyBank aria-hidden="true" className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-text">
            {cards.goalsAndBudgets.title}
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">
            {cards.goalsAndBudgets.description}
          </p>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-text">{cards.goalsAndBudgets.goalLabel}</span>
            <span className="text-text-secondary tabular-nums">
              {cards.goalsAndBudgets.goalProgress}
            </span>
          </div>
          <div
            aria-hidden="true"
            className="h-1.5 w-full overflow-hidden rounded-[var(--radius-pill)] bg-surface-subtle"
          >
            <div className="h-full w-[68%] rounded-[var(--radius-pill)] bg-brand" />
          </div>
        </div>
      </TiltCard>

      {/* 5. Gastos compartidos */}
      <TiltCard
        className="t-surface-enter lg:col-span-3"
        maxTiltDeg={4}
        cardClassName="flex h-full flex-col justify-between gap-6 p-6"
      >
        <div className="space-y-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-soft text-brand-text">
            <Users aria-hidden="true" className="h-5 w-5" />
          </span>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-text">
            {cards.splits.title}
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">{cards.splits.description}</p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-4 text-xs font-medium">
          <span className="truncate text-text">{cards.splits.splitLabel}</span>
          <span className="shrink-0 rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-3 py-1 text-text-secondary">
            {cards.splits.splitCount}
          </span>
        </div>
      </TiltCard>

      {/* 6. Wallet cripto — Patrón «Muy pronto» (Principio IV, solo informativa) */}
      <TiltCard
        className="t-surface-enter lg:col-span-3"
        maxTiltDeg={4}
        cardClassName="flex h-full flex-col justify-between gap-5 p-6"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-border bg-brand-violet/12 text-brand-violet">
              <Coins aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-3 py-1 text-xs font-semibold text-text-secondary">
              {cards.crypto.badge}
            </span>
          </div>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-text">
            {cards.crypto.title}
          </h3>
          <p className="text-sm leading-relaxed text-text-secondary">{cards.crypto.description}</p>
        </div>
      </TiltCard>
    </div>
  );
}
