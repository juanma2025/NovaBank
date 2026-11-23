import {
  type BudgetAlert,
  type BudgetAlertList,
  BudgetAlertListSchema,
  BudgetAlertSchema,
  type BudgetCategory,
  type BudgetMonth,
  BudgetMonthSchema,
  type BudgetTransfer,
  BudgetTransferSchema,
  type BudgetTransfersPage,
  BudgetTransfersPageSchema,
} from '@nova/shared';

import type { HttpClient } from '../../../lib/http-client.ts';

export interface ListBudgetTransfersParams {
  month?: string;
  cursor?: string;
  limit?: number;
}

/**
 * Servicio POO de presupuesto mensual, reclasificación de transferencias y alertas (spec 006).
 * El presupuesto es estrictamente informativo: no mueve dinero ni usa `Idempotency-Key`.
 */
export class BudgetService {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  async getMonth(month?: string, signal?: AbortSignal): Promise<BudgetMonth> {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    const data = await this.client.request<unknown>(`/budgets${query}`, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return BudgetMonthSchema.parse(data);
  }

  async setLimit(category: BudgetCategory, monthlyLimit: number): Promise<BudgetMonth> {
    const data = await this.client.request<unknown>(
      `/budgets/limits/${encodeURIComponent(category)}`,
      {
        method: 'PUT',
        body: { monthlyLimit },
      },
    );
    return BudgetMonthSchema.parse(data);
  }

  async removeLimit(category: BudgetCategory): Promise<BudgetMonth> {
    const data = await this.client.request<unknown>(
      `/budgets/limits/${encodeURIComponent(category)}`,
      {
        method: 'DELETE',
      },
    );
    return BudgetMonthSchema.parse(data);
  }

  async listAlerts(signal?: AbortSignal): Promise<BudgetAlertList> {
    const data = await this.client.request<unknown>('/budgets/alerts', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return BudgetAlertListSchema.parse(data);
  }

  async markAlertSeen(alertId: string): Promise<BudgetAlert> {
    const data = await this.client.request<unknown>(
      `/budgets/alerts/${encodeURIComponent(alertId)}/seen`,
      {
        method: 'POST',
      },
    );
    return BudgetAlertSchema.parse(data);
  }

  async listTransfers(
    params: ListBudgetTransfersParams = {},
    signal?: AbortSignal,
  ): Promise<BudgetTransfersPage> {
    const search = new URLSearchParams();
    if (params.month) search.set('month', params.month);
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    const qs = search.toString();
    const data = await this.client.request<unknown>(`/budgets/transfers${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return BudgetTransfersPageSchema.parse(data);
  }

  async setTransferCategory(
    transactionId: string,
    category: BudgetCategory,
  ): Promise<BudgetTransfer> {
    const data = await this.client.request<unknown>(
      `/budgets/transfers/${encodeURIComponent(transactionId)}/category`,
      {
        method: 'PUT',
        body: { category },
      },
    );
    return BudgetTransferSchema.parse(data);
  }
}
