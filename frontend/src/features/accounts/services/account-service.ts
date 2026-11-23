import {
  type AccountSummary,
  AccountSummarySchema,
  type MovementsPage,
  MovementsPageSchema,
} from '@nova/shared';

import type { HttpClient } from '../../../lib/http-client.ts';

export interface ListMovementsParams {
  cursor?: string;
  limit?: number;
}

/**
 * Servicio POO para consultar la cuenta COP y el historial de movimientos (spec 002).
 * Recibe `HttpClient` por inyección en el constructor para desacoplar la red y facilitar pruebas.
 */
export class AccountService {
  constructor(private readonly http: HttpClient) {}

  async getMyAccount(signal?: AbortSignal): Promise<AccountSummary> {
    const data = await this.http.request<unknown>('/accounts/me', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return AccountSummarySchema.parse(data);
  }

  async listMyMovements(
    params: ListMovementsParams = {},
    signal?: AbortSignal,
  ): Promise<MovementsPage> {
    const search = new URLSearchParams();
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    const query = search.toString();
    const path = query ? `/accounts/me/movements?${query}` : '/accounts/me/movements';

    const data = await this.http.request<unknown>(path, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return MovementsPageSchema.parse(data);
  }
}
