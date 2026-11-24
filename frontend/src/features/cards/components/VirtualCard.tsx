import { type Card, maskCardNumber } from '@nova/shared';
import { CreditCard, Snowflake } from 'lucide-react';

import { NovaMark } from '../../../components/NovaMark.tsx';
import { CARDS_MESSAGES } from '../../../lib/messages.ts';
import { formatCardExpiry, isCardExpiredInBogota } from '../utils/card-expiry.ts';

export interface VirtualCardProps {
  card: Card;
  now?: Date;
}

type VisualCardState = 'active' | 'frozen' | 'canceled' | 'expired';

function resolveVisualState(card: Card, now?: Date): VisualCardState {
  if (card.status === 'canceled') return 'canceled';
  if (isCardExpiredInBogota(card.expMonth, card.expYear, now)) return 'expired';
  if (card.status === 'frozen') return 'frozen';
  return 'active';
}

const BADGE_CLASSES: Record<VisualCardState, string> = {
  active: 'bg-emerald-400/18 text-emerald-200 border-emerald-300/35',
  frozen: 'bg-sky-400/18 text-sky-200 border-sky-300/35',
  expired: 'bg-amber-400/18 text-amber-200 border-amber-300/35',
  canceled: 'bg-white/10 text-white/75 border-white/20',
};

/**
 * Representación visual estilo Apple de una tarjeta virtual Nova (spec 004, T017 y T037).
 * Solo muestra los últimos 4 dígitos (`maskCardNumber`) y estado en texto (nunca solo color).
 */
export function VirtualCard({ card, now }: VirtualCardProps) {
  const visualState = resolveVisualState(card, now);
  const statusLabel = CARDS_MESSAGES.statusLabels[visualState];
  const isMuted = visualState === 'canceled' || visualState === 'expired';

  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius-xl)] border border-white/15 p-5 text-white shadow-[var(--shadow-elevated)] transition-transform duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] hover:-translate-y-0.5 sm:p-6 ${
        isMuted
          ? 'bg-gradient-to-br from-[#161822] via-[#1c1f2b] to-[#12141c] opacity-75'
          : visualState === 'frozen'
            ? 'bg-gradient-to-br from-[#081726] via-[#0f2942] to-[#1a2244]'
            : 'bg-gradient-to-br from-[#070b14] via-[#101e38] to-[#23194d]'
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-10 h-36 w-36 rounded-full bg-[#38bdf8]/25 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-[#a78bfa]/25 blur-2xl"
      />

      <div className="relative space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <NovaMark className="h-7 w-7 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{card.nickname}</p>
              <p className="text-[11px] font-medium text-white/65">Nova Virtual · COP</p>
            </div>
          </div>

          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-xs font-semibold ${BADGE_CLASSES[visualState]}`}
          >
            {visualState === 'frozen' ? (
              <Snowflake aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <CreditCard aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{statusLabel}</span>
          </span>
        </div>

        <p className="text-lg font-semibold tracking-[0.18em] text-white/95 tabular-nums sm:text-xl">
          {maskCardNumber(card.last4)}
        </p>

        <div className="flex items-end justify-between gap-4 border-t border-white/12 pt-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-white/60">{CARDS_MESSAGES.holderLabel}</p>
            <p className="truncate text-xs font-semibold tracking-[0.06em] text-white/90">
              {card.holderName}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[10px] font-medium text-white/60">{CARDS_MESSAGES.expiryLabel}</p>
            <p className="text-xs font-semibold tracking-[0.08em] text-white/90 tabular-nums">
              {formatCardExpiry(card.expMonth, card.expYear)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
