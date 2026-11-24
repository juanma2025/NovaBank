import {
  type CreateTopupRequest,
  IDEMPOTENCY_HEADER,
  type TopupLimits,
  TopupLimitsSchema,
  type TopupResult,
  TopupResultSchema,
} from '@nova/shared';

import type { HttpClient } from '../../../lib/http-client.ts';

/**
 * Servicio POO para límites y recargas simuladas (spec 002).
 * Envía siempre la cabecera `IDEMPOTENCY_HEADER` en `createTopup` (Principio I, regla 4).
 */
export class TopupService {
  constructor(private readonly http: HttpClient) {}

  async getTopupLimits(signal?: AbortSignal): Promise<TopupLimits> {
    const data = await this.http.request<unknown>('/topups/limits', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return TopupLimitsSchema.parse(data);
  }

  async createTopup(input: CreateTopupRequest, idempotencyKey: string): Promise<TopupResult> {
    const data = await this.http.request<unknown>('/topups', {
      method: 'POST',
      body: input,
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
    });
    return TopupResultSchema.parse(data);
  }
}
