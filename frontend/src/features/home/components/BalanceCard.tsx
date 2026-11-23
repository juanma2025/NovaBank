import {
  CreditCard,
  Eye,
  EyeOff,
  PieChart,
  PiggyBank,
  PlusCircle,
  Send,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { SubtleNumber } from '../../../components/SubtleNumber.tsx';
import { HOME_MESSAGES } from '../../../lib/messages.ts';

export interface BalanceCardProps {
  balance: number;
  hidden: boolean;
  onToggleHidden: () => void;
}

export function BalanceCard({ balance, hidden, onToggleHidden }: BalanceCardProps) {
  return (
    <GlassCard className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text-secondary">
            {HOME_MESSAGES.balanceLabel}
          </span>
          <span className="inline-flex items-center rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-text-secondary">
            {HOME_MESSAGES.currencyBadge}
          </span>
        </div>

        <button
          type="button"
          aria-pressed={hidden}
          aria-label={hidden ? HOME_MESSAGES.showBalance : HOME_MESSAGES.hideBalance}
          onClick={onToggleHidden}
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface/85 px-3 text-sm font-medium text-text-secondary shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-surface-subtle hover:text-text"
        >
          <span
            aria-hidden="true"
            className="t-icon-swap h-[18px] w-[18px]"
            data-state={hidden ? 'b' : 'a'}
          >
            <Eye className="t-icon h-[18px] w-[18px]" data-slot="a" />
            <EyeOff className="t-icon h-[18px] w-[18px]" data-slot="b" />
          </span>
          <span className="hidden sm:inline">
            {hidden ? HOME_MESSAGES.showBalance : HOME_MESSAGES.hideBalance}
          </span>
        </button>
      </div>

      <div>
        <p className="text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.035em] text-text sm:text-[2.75rem]">
          <SubtleNumber
            value={balance}
            hidden={hidden}
            hiddenAriaLabel={HOME_MESSAGES.balanceHiddenSr}
          />
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 border-t border-border pt-4 sm:flex sm:flex-wrap sm:items-center">
        <Link
          to="/recargar"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand px-4 py-2.5 text-sm font-semibold tracking-[-0.01em] text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-brand-hover active:bg-brand-active"
        >
          <PlusCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{HOME_MESSAGES.topupAction}</span>
        </Link>

        <Link
          to="/enviar"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface/90 px-4 py-2.5 text-sm font-semibold tracking-[-0.01em] text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-surface-subtle"
        >
          <Send aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{HOME_MESSAGES.sendAction}</span>
        </Link>

        <Link
          to="/tarjetas"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface/90 px-4 py-2.5 text-sm font-semibold tracking-[-0.01em] text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-surface-subtle"
        >
          <CreditCard aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{HOME_MESSAGES.cardsAction}</span>
        </Link>

        <Link
          to="/tienda"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface/90 px-4 py-2.5 text-sm font-semibold tracking-[-0.01em] text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-surface-subtle"
        >
          <ShoppingBag aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{HOME_MESSAGES.storeAction}</span>
        </Link>

        <Link
          to="/metas"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface/90 px-4 py-2.5 text-sm font-semibold tracking-[-0.01em] text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-surface-subtle"
        >
          <PiggyBank aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{HOME_MESSAGES.goalsAction}</span>
        </Link>

        <Link
          to="/presupuesto"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface/90 px-4 py-2.5 text-sm font-semibold tracking-[-0.01em] text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-surface-subtle"
        >
          <PieChart aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{HOME_MESSAGES.budgetAction}</span>
        </Link>

        <Link
          to="/compartidos"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-strong bg-surface/90 px-4 py-2.5 text-sm font-semibold tracking-[-0.01em] text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-surface-subtle"
        >
          <Users aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{HOME_MESSAGES.splitsAction}</span>
        </Link>
      </div>
    </GlassCard>
  );
}
