import {
  type CreateSplitRequest,
  MOVEMENTS_PAGE_SIZE,
  type PayShareRequest,
  type PayShareResult,
  type Split,
  type SplitsPage,
  type SplitsSummary,
} from '@nova/shared';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';
import { ACCOUNT_QUERY_KEY } from '../../accounts/hooks/useAccount.ts';
import { MOVEMENTS_QUERY_KEY } from '../../accounts/hooks/useMovements.ts';
import { IdempotencyKeyManager } from '../../accounts/services/idempotency-key-manager.ts';
import {
  BUDGET_ALERTS_QUERY_KEY,
  BUDGET_QUERY_KEY,
  BUDGET_TRANSFERS_QUERY_KEY,
} from '../../budgets/hooks/useBudgets.ts';
import { TRANSFER_LIMITS_QUERY_KEY } from '../../transfers/hooks/useTransferLimits.ts';

export const SPLITS_QUERY_KEY = ['splits'] as const;
export const SPLITS_SUMMARY_QUERY_KEY = ['splits', 'summary'] as const;

export function splitDetailQueryKey(splitId: string) {
  return ['splits', 'detail', splitId] as const;
}

export function useSplitsList(limit = MOVEMENTS_PAGE_SIZE) {
  const { splitsService } = useAuthServices();

  return useInfiniteQuery<
    SplitsPage,
    ApiError,
    InfiniteData<SplitsPage, string | undefined>,
    readonly ['splits', 'list', number],
    string | undefined
  >({
    queryKey: ['splits', 'list', limit] as const,
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      splitsService.list(pageParam ? { cursor: pageParam, limit } : { limit }, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
}

export function useSplitsSummary() {
  const { splitsService } = useAuthServices();

  return useQuery<SplitsSummary, ApiError>({
    queryKey: SPLITS_SUMMARY_QUERY_KEY,
    queryFn: ({ signal }) => splitsService.getSummary(signal),
    retry: false,
  });
}

export function useSplitDetail(splitId: string) {
  const { splitsService } = useAuthServices();

  return useQuery<Split, ApiError>({
    queryKey: splitDetailQueryKey(splitId),
    enabled: Boolean(splitId),
    queryFn: ({ signal }) => splitsService.get(splitId, signal),
    retry: false,
  });
}

export function useCreateSplit() {
  const { splitsService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Split, ApiError, CreateSplitRequest>({
    mutationFn: (payload) => splitsService.create(payload),
    onSuccess: async (created) => {
      queryClient.setQueryData(splitDetailQueryKey(created.id), created);
      await queryClient.invalidateQueries({ queryKey: SPLITS_QUERY_KEY });
    },
  });
}

/**
 * Pagar mi parte con transferencia idempotente (spec 007 · FR-005/FR-006).
 * Conserva la misma `Idempotency-Key` ante fallos de red o 5xx (sin incluir la contraseña en la huella).
 */
export function usePaySplitShare(splitId: string) {
  const { splitsService } = useAuthServices();
  const queryClient = useQueryClient();
  const keyManagerRef = useRef<IdempotencyKeyManager | null>(null);
  keyManagerRef.current ??= new IdempotencyKeyManager();

  const mutation = useMutation<PayShareResult, ApiError, PayShareRequest>({
    mutationFn: async (payload) => {
      const key =
        keyManagerRef.current?.getOrCreateForAttempt(`pay-split:${splitId}`) ?? crypto.randomUUID();
      return splitsService.payMyShare(splitId, payload, key);
    },
    onSuccess: async (result) => {
      keyManagerRef.current?.reset();
      queryClient.setQueryData(splitDetailQueryKey(splitId), result.split);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: TRANSFER_LIMITS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SPLITS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: BUDGET_ALERTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: BUDGET_TRANSFERS_QUERY_KEY }),
      ]);
    },
    onError: (error) => {
      const isRetryableTransport = error.code === 'NETWORK' || error.status >= 500;
      if (!isRetryableTransport) {
        keyManagerRef.current?.reset();
      }
    },
  });

  const resetAttempt = useCallback(() => {
    keyManagerRef.current?.reset();
  }, []);

  return { ...mutation, resetAttempt };
}

export function useDeclineShare(splitId: string) {
  const { splitsService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Split, ApiError>({
    mutationFn: () => splitsService.declineMyShare(splitId),
    onSuccess: async (updated) => {
      queryClient.setQueryData(splitDetailQueryKey(splitId), updated);
      await queryClient.invalidateQueries({ queryKey: SPLITS_QUERY_KEY });
    },
  });
}

export function useMarkSharePaid(splitId: string) {
  const { splitsService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Split, ApiError, string>({
    mutationFn: (shareId) => splitsService.markSharePaid(splitId, shareId),
    onSuccess: async (updated) => {
      queryClient.setQueryData(splitDetailQueryKey(splitId), updated);
      await queryClient.invalidateQueries({ queryKey: SPLITS_QUERY_KEY });
    },
  });
}

export function useRemindShare(splitId: string) {
  const { splitsService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Split, ApiError, string>({
    mutationFn: (shareId) => splitsService.remindShare(splitId, shareId),
    onSuccess: (updated) => {
      queryClient.setQueryData(splitDetailQueryKey(splitId), updated);
    },
  });
}

export function useCancelSplit(splitId: string) {
  const { splitsService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Split, ApiError>({
    mutationFn: () => splitsService.cancel(splitId),
    onSuccess: async (updated) => {
      queryClient.setQueryData(splitDetailQueryKey(splitId), updated);
      await queryClient.invalidateQueries({ queryKey: SPLITS_QUERY_KEY });
    },
  });
}
