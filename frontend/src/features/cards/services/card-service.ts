import {
  type Card,
  type CardList,
  CardListSchema,
  type CardPaymentsPage,
  CardPaymentsPageSchema,
  CardSchema,
  type CardSecrets,
  CardSecretsSchema,
} from '@nova/shared';

import type { HttpClient } from '../../../lib/http-client.ts';

export interface ListCardPaymentsParams {
  cursor?: string;
  limit?: number;
}

/**
 * Servicio POO para gestionar tarjetas virtuales (spec 004).
 * `revealCard` entrega los secretos sin almacenarlos en cachés ni en almacenamiento persistente.
 */
export class CardService {
  constructor(private readonly http: HttpClient) {}

  async listCards(signal?: AbortSignal): Promise<CardList> {
    const data = await this.http.request<unknown>('/cards', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return CardListSchema.parse(data);
  }

  async issueCard(nickname: string, signal?: AbortSignal): Promise<Card> {
    const data = await this.http.request<unknown>('/cards', {
      method: 'POST',
      body: { nickname },
      ...(signal ? { signal } : {}),
    });
    return CardSchema.parse(data);
  }

  async renameCard(cardId: string, nickname: string, signal?: AbortSignal): Promise<Card> {
    const data = await this.http.request<unknown>(`/cards/${cardId}`, {
      method: 'PATCH',
      body: { nickname },
      ...(signal ? { signal } : {}),
    });
    return CardSchema.parse(data);
  }

  async freezeCard(cardId: string, signal?: AbortSignal): Promise<Card> {
    const data = await this.http.request<unknown>(`/cards/${cardId}/freeze`, {
      method: 'POST',
      ...(signal ? { signal } : {}),
    });
    return CardSchema.parse(data);
  }

  async unfreezeCard(cardId: string, signal?: AbortSignal): Promise<Card> {
    const data = await this.http.request<unknown>(`/cards/${cardId}/unfreeze`, {
      method: 'POST',
      ...(signal ? { signal } : {}),
    });
    return CardSchema.parse(data);
  }

  async cancelCard(cardId: string, signal?: AbortSignal): Promise<Card> {
    const data = await this.http.request<unknown>(`/cards/${cardId}/cancel`, {
      method: 'POST',
      ...(signal ? { signal } : {}),
    });
    return CardSchema.parse(data);
  }

  async revealCard(cardId: string, password: string, signal?: AbortSignal): Promise<CardSecrets> {
    const data = await this.http.request<unknown>(`/cards/${cardId}/reveal`, {
      method: 'POST',
      body: { password },
      ...(signal ? { signal } : {}),
    });
    return CardSecretsSchema.parse(data);
  }

  async listCardPayments(
    cardId: string,
    params: ListCardPaymentsParams = {},
    signal?: AbortSignal,
  ): Promise<CardPaymentsPage> {
    const search = new URLSearchParams();
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    const query = search.toString();
    const path = query ? `/cards/${cardId}/payments?${query}` : `/cards/${cardId}/payments`;
    const data = await this.http.request<unknown>(path, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return CardPaymentsPageSchema.parse(data);
  }
}
