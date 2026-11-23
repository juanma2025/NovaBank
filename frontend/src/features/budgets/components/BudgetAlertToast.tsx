import { type BudgetAlert, formatCOP } from '@nova/shared';
import { AlertTriangle, OctagonAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { BUDGET_MESSAGES } from '../../../lib/messages.ts';
import { useBudgetAlerts, useMarkAlertSeen } from '../hooks/useBudgets.ts';

export interface BudgetAlertToastProps {
  /** Se activa justo después de completar un pago o transferencia (spec 006, T020). */
  active: boolean;
}

/**
 * Muestra alertas de presupuesto no vistas tras un gasto y las marca vistas automáticamente
 * en el servidor para que no vuelvan a aparecer en gastos posteriores (FR-011).
 */
export function BudgetAlertToast({ active }: BudgetAlertToastProps) {
  const alertsQuery = useBudgetAlerts(active);
  const markSeen = useMarkAlertSeen();
  const [visibleAlerts, setVisibleAlerts] = useState<BudgetAlert[]>([]);
  const markedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!active) {
      setVisibleAlerts([]);
      return;
    }
    const items = alertsQuery.data?.items ?? [];
    const unseen = items.filter((alert) => !alert.seen && !markedIdsRef.current.has(alert.id));
    if (unseen.length === 0) return;

    for (const alert of unseen) {
      markedIdsRef.current.add(alert.id);
      markSeen.mutate(alert.id);
    }

    setVisibleAlerts((prev) => {
      const existingIds = new Set(prev.map((a) => a.id));
      const merged = [...prev];
      for (const alert of unseen) {
        if (!existingIds.has(alert.id)) merged.push(alert);
      }
      return merged;
    });
  }, [active, alertsQuery.data, markSeen]);

  if (!active || visibleAlerts.length === 0) return null;

  return (
    <div role="status" aria-live="polite" className="t-toast is-open space-y-2.5">
      {visibleAlerts.map((alert) => {
        const isExceeded = alert.threshold === 100;
        const percent = Math.floor((alert.spent * 100) / alert.limit);
        const title = isExceeded
          ? BUDGET_MESSAGES.alertExceededTitle(alert.category)
          : BUDGET_MESSAGES.alertWarningTitle(alert.category, percent);

        return (
          <div
            key={alert.id}
            className={`nova-glass flex items-start justify-between gap-3 rounded-[var(--radius-lg)] border p-4 ${
              isExceeded
                ? 'border-danger-border bg-danger-bg text-danger'
                : 'border-warning-border bg-warning-bg text-warning'
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              {isExceeded ? (
                <OctagonAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs opacity-90 tabular-nums">
                  {BUDGET_MESSAGES.alertSpentDetail(formatCOP(alert.spent), formatCOP(alert.limit))}
                </p>
                <Link
                  to="/presupuesto"
                  className="inline-flex min-h-11 items-center text-xs font-semibold underline"
                >
                  {BUDGET_MESSAGES.alertGoToBudget}
                </Link>
              </div>
            </div>

            <button
              type="button"
              aria-label={BUDGET_MESSAGES.alertDismiss}
              onClick={() => {
                setVisibleAlerts((prev) => prev.filter((item) => item.id !== alert.id));
              }}
              className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] transition-opacity hover:opacity-80"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
