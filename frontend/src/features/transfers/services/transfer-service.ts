import {
  type CreateTransferRequest,
  IDEMPOTENCY_HEADER,
  type RecipientPreview,
  RecipientPreviewSchema,
  type TransferLimits,
  TransferLimitsSchema,
  type TransferResult,
  TransferResultSchema,
} from '@nova/shared';

import type { HttpClient } from '../../../lib/http-client.ts';

/**
 * Servicio POO para búsqueda de destinatarios, límites y envíos entre estudiantes (spec 003).
 * Recibe `HttpClient` por inyección en el constructor y envía `Idempotency-Key` en cada envío.
 */
export class TransferService {
  constructor(private readonly http: HttpClient) {}

  async findRecipient(query: string, signal?: AbortSignal): Promise<RecipientPreview> {
    const search = new URLSearchParams({ q: query.trim() });
    const data = await this.http.request<unknown>(`/transfers/recipient?${search.toString()}`, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return RecipientPreviewSchema.parse(data);
  }

  async getLimits(signal?: AbortSignal): Promise<TransferLimits> {
    const data = await this.http.request<unknown>('/transfers/limits', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return TransferLimitsSchema.parse(data);
  }

  async createTransfer(
    payload: CreateTransferRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<TransferResult> {
    const data = await this.http.request<unknown>('/transfers', {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      body: payload,
      ...(signal ? { signal } : {}),
    });
    return TransferResultSchema.parse(data);
  }
}
