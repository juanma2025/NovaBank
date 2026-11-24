import {
  type CreateSplitRequest,
  IDEMPOTENCY_HEADER,
  type PayShareRequest,
  type PayShareResult,
  PayShareResultSchema,
  type Split,
  SplitSchema,
  type SplitsPage,
  SplitsPageSchema,
  type SplitsSummary,
  SplitsSummarySchema,
} from '@nova/shared';

import type { HttpClient } from '../../../lib/http-client.ts';

export interface ListSplitsParams {
  cursor?: string;
  limit?: number;
}

/**
 * Servicio POO de gastos compartidos (spec 007).
 * Solo `payMyShare` mueve dinero y exige `Idempotency-Key` (regla de dominio 11).
 */
export class SplitsService {
  private readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  async list(params: ListSplitsParams = {}, signal?: AbortSignal): Promise<SplitsPage> {
    const search = new URLSearchParams();
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    const qs = search.toString();
    const data = await this.client.request<unknown>(`/splits${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return SplitsPageSchema.parse(data);
  }

  async getSummary(signal?: AbortSignal): Promise<SplitsSummary> {
    const data = await this.client.request<unknown>('/splits/summary', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return SplitsSummarySchema.parse(data);
  }

  async get(splitId: string, signal?: AbortSignal): Promise<Split> {
    const data = await this.client.request<unknown>(`/splits/${encodeURIComponent(splitId)}`, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return SplitSchema.parse(data);
  }

  async create(payload: CreateSplitRequest): Promise<Split> {
    const data = await this.client.request<unknown>('/splits', {
      method: 'POST',
      body: payload,
    });
    return SplitSchema.parse(data);
  }

  async payMyShare(
    splitId: string,
    payload: PayShareRequest,
    idempotencyKey: string,
  ): Promise<PayShareResult> {
    const data = await this.client.request<unknown>(
      `/splits/${encodeURIComponent(splitId)}/shares/me/pay`,
      {
        method: 'POST',
        headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
        body: payload,
      },
    );
    return PayShareResultSchema.parse(data);
  }

  async declineMyShare(splitId: string): Promise<Split> {
    const data = await this.client.request<unknown>(
      `/splits/${encodeURIComponent(splitId)}/shares/me/decline`,
      {
        method: 'POST',
      },
    );
    return SplitSchema.parse(data);
  }

  async markSharePaid(splitId: string, shareId: string): Promise<Split> {
    const data = await this.client.request<unknown>(
      `/splits/${encodeURIComponent(splitId)}/shares/${encodeURIComponent(shareId)}/mark-paid`,
      {
        method: 'POST',
      },
    );
    return SplitSchema.parse(data);
  }

  async remindShare(splitId: string, shareId: string): Promise<Split> {
    const data = await this.client.request<unknown>(
      `/splits/${encodeURIComponent(splitId)}/shares/${encodeURIComponent(shareId)}/remind`,
      {
        method: 'POST',
      },
    );
    return SplitSchema.parse(data);
  }

  async cancel(splitId: string): Promise<Split> {
    const data = await this.client.request<unknown>(
      `/splits/${encodeURIComponent(splitId)}/cancel`,
      {
        method: 'POST',
      },
    );
    return SplitSchema.parse(data);
  }
}
