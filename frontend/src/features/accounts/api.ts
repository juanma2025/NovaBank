import type {
  AccountSummary,
  CreateTopupRequest,
  MovementsPage,
  TopupLimits,
  TopupResult,
} from '@nova/shared';

import { httpClient } from '../../lib/api-client.ts';
import { AccountService, type ListMovementsParams } from './services/account-service.ts';
import { TopupService } from './services/topup-service.ts';

export const accountService = new AccountService(httpClient);
export const topupService = new TopupService(httpClient);

export function getMyAccount(signal?: AbortSignal): Promise<AccountSummary> {
  return accountService.getMyAccount(signal);
}

export function listMyMovements(
  params?: ListMovementsParams,
  signal?: AbortSignal,
): Promise<MovementsPage> {
  return accountService.listMyMovements(params, signal);
}

export function getTopupLimits(signal?: AbortSignal): Promise<TopupLimits> {
  return topupService.getTopupLimits(signal);
}

export function createTopup(
  input: CreateTopupRequest,
  idempotencyKey: string,
): Promise<TopupResult> {
  return topupService.createTopup(input, idempotencyKey);
}
