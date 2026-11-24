import {
  type CardPaymentResult,
  CardPaymentResultSchema,
  type CreateCardPaymentRequest,
  IDEMPOTENCY_HEADER,
  type PaymentLimits,
  PaymentLimitsSchema,
} from '@nova/shared';

import type { HttpClient } from '../../../lib/http-client.ts';

/**
 * Servicio POO para consultar límites y ejecutar pagos simulados en la tienda demo (spec 004).
 */
export class StoreService {
  constructor(private readonly http: HttpClient) {}

  async getLimits(signal?: AbortSignal): Promise<PaymentLimits> {
    const data = await this.http.request<unknown>('/store/limits', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return PaymentLimitsSchema.parse(data);
  }

  async pay(
    payload: CreateCardPaymentRequest,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<CardPaymentResult> {
    const data = await this.http.request<unknown>('/store/payments', {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      body: payload,
      ...(signal ? { signal } : {}),
    });
    return CardPaymentResultSchema.parse(data);
  }
}
