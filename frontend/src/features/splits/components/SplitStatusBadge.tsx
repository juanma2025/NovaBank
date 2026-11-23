import type { SplitShareStatus, SplitStatus } from '@nova/shared';
import { Banknote, Ban, CheckCircle2, Clock, XCircle } from 'lucide-react';

import { SPLITS_MESSAGES } from '../../../lib/messages.ts';

/** Badge con icono y texto explícito para el estado de una división (spec 007). */
export function SplitStatusBadge({ status }: { status: SplitStatus }) {
  const label = SPLITS_MESSAGES.splitStatusLabels[status];
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-success-border bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">
        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'canceled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-text-muted">
        <XCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-info-border bg-info-bg px-2.5 py-0.5 text-xs font-semibold text-info">
      <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

/** Badge con icono y texto explícito para el estado de cada parte (spec 007). */
export function ShareStatusBadge({ status }: { status: SplitShareStatus }) {
  const label = SPLITS_MESSAGES.shareStatusLabels[status];
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-success-border bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">
        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'paid_outside') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-success-border bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">
        <Banknote aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'declined') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-warning-border bg-warning-bg px-2.5 py-0.5 text-xs font-semibold text-warning">
        <Ban aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'canceled') {
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-border bg-surface-subtle px-2.5 py-0.5 text-xs font-semibold text-text-muted">
        <XCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-info-border bg-info-bg px-2.5 py-0.5 text-xs font-semibold text-info">
      <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
