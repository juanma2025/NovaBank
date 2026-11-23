import {
  type CloseGoalResult,
  CloseGoalResultSchema,
  type CreateGoalRequest,
  type Goal,
  type GoalList,
  GoalListSchema,
  GoalSchema,
  IDEMPOTENCY_HEADER,
  type MovementsPage,
  MovementsPageSchema,
  type SavingsLimits,
  SavingsLimitsSchema,
  type SavingsMovementResult,
  SavingsMovementResultSchema,
  type UpdateGoalRequest,
} from '@nova/shared';

import type { HttpClient } from '../../../lib/http-client.ts';

export interface ListGoalMovementsParams {
  cursor?: string;
  limit?: number;
}

/** Servicio POO para gestionar metas de ahorro y movimientos de subcuentas (spec 005). */
export class SavingsService {
  constructor(private readonly http: HttpClient) {}

  async listGoals(signal?: AbortSignal): Promise<GoalList> {
    const data = await this.http.request<unknown>('/savings/goals', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return GoalListSchema.parse(data);
  }

  async createGoal(payload: CreateGoalRequest, signal?: AbortSignal): Promise<Goal> {
    const data = await this.http.request<unknown>('/savings/goals', {
      method: 'POST',
      body: payload,
      ...(signal ? { signal } : {}),
    });
    return GoalSchema.parse(data);
  }

  async updateGoal(
    goalId: string,
    payload: UpdateGoalRequest,
    signal?: AbortSignal,
  ): Promise<Goal> {
    const data = await this.http.request<unknown>(`/savings/goals/${goalId}`, {
      method: 'PATCH',
      body: payload,
      ...(signal ? { signal } : {}),
    });
    return GoalSchema.parse(data);
  }

  async deposit(
    goalId: string,
    amount: number,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<SavingsMovementResult> {
    const data = await this.http.request<unknown>(`/savings/goals/${goalId}/deposits`, {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      body: { amount },
      ...(signal ? { signal } : {}),
    });
    return SavingsMovementResultSchema.parse(data);
  }

  async withdraw(
    goalId: string,
    amount: number,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<SavingsMovementResult> {
    const data = await this.http.request<unknown>(`/savings/goals/${goalId}/withdrawals`, {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      body: { amount },
      ...(signal ? { signal } : {}),
    });
    return SavingsMovementResultSchema.parse(data);
  }

  async closeGoal(
    goalId: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<CloseGoalResult> {
    const data = await this.http.request<unknown>(`/savings/goals/${goalId}/close`, {
      method: 'POST',
      headers: { [IDEMPOTENCY_HEADER]: idempotencyKey },
      ...(signal ? { signal } : {}),
    });
    return CloseGoalResultSchema.parse(data);
  }

  async listGoalMovements(
    goalId: string,
    params: ListGoalMovementsParams = {},
    signal?: AbortSignal,
  ): Promise<MovementsPage> {
    const search = new URLSearchParams();
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    const query = search.toString();
    const path = query
      ? `/savings/goals/${goalId}/movements?${query}`
      : `/savings/goals/${goalId}/movements`;
    const data = await this.http.request<unknown>(path, {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return MovementsPageSchema.parse(data);
  }

  async getLimits(signal?: AbortSignal): Promise<SavingsLimits> {
    const data = await this.http.request<unknown>('/savings/limits', {
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
    return SavingsLimitsSchema.parse(data);
  }
}
