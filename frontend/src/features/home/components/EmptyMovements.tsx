import { PlusCircle, Wallet } from 'lucide-react';
import { Link } from 'react-router';

import { HOME_MESSAGES } from '../../../lib/messages.ts';

export interface EmptyMovementsProps {
  showTopupLink?: boolean;
}

export function EmptyMovements({ showTopupLink = true }: EmptyMovementsProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-surface-subtle text-brand-text">
        <Wallet aria-hidden="true" className="h-5 w-5" />
      </div>

      <div className="max-w-xs space-y-1">
        <p className="text-base font-semibold text-text">{HOME_MESSAGES.emptyTitle}</p>
        <p className="text-sm leading-relaxed text-text-secondary">
          {HOME_MESSAGES.emptyDescription}
        </p>
      </div>

      {showTopupLink && (
        <Link
          to="/recargar"
          className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-brand px-5 py-2.5 text-[15px] font-semibold tracking-[-0.01em] text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-brand-hover active:bg-brand-active"
        >
          <PlusCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{HOME_MESSAGES.emptyAction}</span>
        </Link>
      )}
    </div>
  );
}
