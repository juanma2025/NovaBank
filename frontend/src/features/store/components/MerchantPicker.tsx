import { DEMO_MERCHANTS, type MerchantId } from '@nova/shared';
import { Store } from 'lucide-react';

import { GlassCard } from '../../../components/GlassCard.tsx';
import { MERCHANT_CATEGORY_LABELS, STORE_MESSAGES } from '../../../lib/messages.ts';

export interface MerchantPickerProps {
  selectedId: MerchantId;
  onSelect: (id: MerchantId) => void;
}

export function MerchantPicker({ selectedId, onSelect }: MerchantPickerProps) {
  return (
    <GlassCard className="space-y-4">
      <h2 className="text-base font-semibold tracking-[-0.02em] text-text">
        {STORE_MESSAGES.merchantSectionTitle}
      </h2>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {DEMO_MERCHANTS.map((merchant) => {
          const selected = merchant.id === selectedId;
          return (
            <button
              key={merchant.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(merchant.id)}
              className={`flex min-h-14 cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3.5 py-2.5 text-left transition-colors duration-[var(--duration-quick)] ${
                selected
                  ? 'border-brand bg-brand-soft text-brand-text'
                  : 'border-border bg-surface/80 text-text hover:bg-surface-subtle'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Store aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm font-semibold">{merchant.name}</span>
              </span>
              <span className="shrink-0 rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                {MERCHANT_CATEGORY_LABELS[merchant.category]}
              </span>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}
