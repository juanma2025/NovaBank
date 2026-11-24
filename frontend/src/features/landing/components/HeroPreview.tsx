import { formatCOP } from '@nova/shared';
import { ArrowDownLeft, ArrowUpRight, CreditCard, ShieldCheck } from 'lucide-react';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { NovaMark } from '../../../components/NovaMark.tsx';
import { LANDING_MESSAGES } from '../../../lib/messages.ts';

const PREVIEW_MOVEMENTS = [
  {
    id: 'topup',
    label: LANDING_MESSAGES.home.previewMovementTopup,
    amount: 50_000,
  },
  {
    id: 'campus',
    label: LANDING_MESSAGES.home.previewMovementCampus,
    amount: -18_500,
  },
  {
    id: 'peer',
    label: LANDING_MESSAGES.home.previewMovementPeer,
    amount: 32_000,
  },
] as const;

/** Vista previa ilustrativa estilo Apple en CSS puro (dinero simulado en COP, cero assets pesados). */
export function HeroPreview() {
  const { home } = LANDING_MESSAGES;

  return (
    <div className="space-y-3">
      <GlassCard className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-secondary">
              {home.previewBalanceLabel}
            </span>
            <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
              {home.previewCurrency}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-success-border bg-success-bg px-2.5 py-0.5 text-[11px] font-medium text-success">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span>{home.previewAccountTag}</span>
          </span>
        </div>

        <p className="text-[2rem] leading-none font-semibold tracking-[-0.035em] text-text tabular-nums sm:text-[2.5rem]">
          {formatCOP(245_000)}
        </p>

        <div
          aria-hidden="true"
          className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-gradient-to-br from-[#070b14] via-[#101c33] to-[#1d1742] p-4 text-white shadow-[var(--shadow-control)]"
        >
          <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-[#38bdf8]/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-[#a78bfa]/25 blur-2xl" />

          <div className="relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <NovaMark className="h-6 w-6 shrink-0" />
              <span className="text-xs font-medium text-white/90">{home.previewCardTitle}</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-white/12 px-2 py-0.5 text-[11px] font-medium text-sky-300">
              <CreditCard className="h-3 w-3" />
              <span>{home.previewCardStatus}</span>
            </span>
          </div>

          <div className="relative mt-5 flex items-end justify-between gap-3">
            <span className="text-sm font-semibold tracking-[0.14em] text-white/95 tabular-nums">
              {home.previewCardLast4}
            </span>
            <span className="text-[10px] font-medium tracking-[0.08em] text-white/70">
              {home.previewCardHolder}
            </span>
          </div>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium text-text-muted">{home.previewMovementsTitle}</p>
          <ul className="divide-y divide-border">
            {PREVIEW_MOVEMENTS.map((item) => {
              const isCredit = item.amount > 0;
              const formatted = isCredit ? `+${formatCOP(item.amount)}` : formatCOP(item.amount);
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border ${
                        isCredit
                          ? 'border-success-border bg-success-bg text-success'
                          : 'border-border bg-surface-subtle text-text-secondary'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft aria-hidden="true" className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="truncate text-sm font-medium text-text">{item.label}</span>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      isCredit ? 'text-success' : 'text-text'
                    }`}
                  >
                    {formatted}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </GlassCard>

      <p className="px-1 text-center text-xs leading-relaxed text-text-muted lg:text-left">
        {home.previewCaption}
      </p>
    </div>
  );
}
