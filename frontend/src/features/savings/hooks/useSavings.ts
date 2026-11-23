import {
  type CloseGoalResult,
  type CreateGoalRequest,
  type Goal,
  type GoalList,
  MOVEMENTS_PAGE_SIZE,
  type MovementsPage,
  type SavingsLimits,
  type SavingsMovementResult,
  type UpdateGoalRequest,
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

export const GOALS_QUERY_KEY = ['goals'] as const;
export const SAVINGS_LIMITS_QUERY_KEY = ['savings-limits'] as const;

export function goalMovementsQueryKey(goalId: string) {
  return ['goals', goalId, 'movements'] as const;
}

export function useGoals() {
  const { savingsService } = useAuthServices();

  return useQuery<GoalList, ApiError>({
    queryKey: GOALS_QUERY_KEY,
    queryFn: ({ signal }) => savingsService.listGoals(signal),
    retry: false,
  });
}

export function useSavingsLimits() {
  const { savingsService } = useAuthServices();

  return useQuery<SavingsLimits, ApiError>({
    queryKey: SAVINGS_LIMITS_QUERY_KEY,
    queryFn: ({ signal }) => savingsService.getLimits(signal),
    retry: false,
  });
}

export function useCreateGoal() {
  const { savingsService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Goal, ApiError, CreateGoalRequest>({
    mutationFn: (payload) => savingsService.createGoal(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: GOALS_QUERY_KEY });
    },
  });
}

export function useUpdateGoal(goalId: string) {
  const { savingsService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Goal, ApiError, UpdateGoalRequest>({
    mutationFn: (payload) => savingsService.updateGoal(goalId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: GOALS_QUERY_KEY });
    },
  });
}

function useIdempotentSavingsMutation<TData, TArg>(
  goalId: string,
  fingerprintFn: (arg: TArg) => string,
  executor: (arg: TArg, key: string) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  const keyManagerRef = useRef<IdempotencyKeyManager | null>(null);
  keyManagerRef.current ??= new IdempotencyKeyManager();

  const mutation = useMutation<TData, ApiError, TArg>({
    mutationFn: async (arg) => {
      const key =
        keyManagerRef.current?.getOrCreateForAttempt(fingerprintFn(arg)) ?? crypto.randomUUID();
      return executor(arg, key);
    },
    onSuccess: async () => {
      keyManagerRef.current?.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: GOALS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SAVINGS_LIMITS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: goalMovementsQueryKey(goalId) }),
      ]);
    },
    onError: (error) => {
      if (!(error.code === 'NETWORK' || error.status >= 500)) {
        keyManagerRef.current?.reset();
      }
    },
  });

  const resetAttempt = useCallback(() => {
    keyManagerRef.current?.reset();
  }, []);

  return { ...mutation, resetAttempt };
}

export function useDeposit(goalId: string) {
  const { savingsService } = useAuthServices();
  return useIdempotentSavingsMutation<SavingsMovementResult, number>(
    goalId,
    (amount) => `deposit:${goalId}:${amount}`,
    (amount, key) => savingsService.deposit(goalId, amount, key),
  );
}

export function useWithdraw(goalId: string) {
  const { savingsService } = useAuthServices();
  return useIdempotentSavingsMutation<SavingsMovementResult, number>(
    goalId,
    (amount) => `withdraw:${goalId}:${amount}`,
    (amount, key) => savingsService.withdraw(goalId, amount, key),
  );
}

export function useCloseGoal(goalId: string) {
  const { savingsService } = useAuthServices();
  const queryClient = useQueryClient();
  const keyManagerRef = useRef<IdempotencyKeyManager | null>(null);
  keyManagerRef.current ??= new IdempotencyKeyManager();

  const mutation = useMutation<CloseGoalResult, ApiError>({
    mutationFn: async () => {
      const key =
        keyManagerRef.current?.getOrCreateForAttempt(`close:${goalId}`) ?? crypto.randomUUID();
      return savingsService.closeGoal(goalId, key);
    },
    onSuccess: async () => {
      keyManagerRef.current?.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACCOUNT_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: GOALS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SAVINGS_LIMITS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: goalMovementsQueryKey(goalId) }),
      ]);
    },
    onError: (error) => {
      if (!(error.code === 'NETWORK' || error.status >= 500)) {
        keyManagerRef.current?.reset();
      }
    },
  });

  const resetAttempt = useCallback(() => {
    keyManagerRef.current?.reset();
  }, []);

  return { ...mutation, resetAttempt };
}

export function useGoalMovements(goalId: string, limit = MOVEMENTS_PAGE_SIZE) {
  const { savingsService } = useAuthServices();

  return useInfiniteQuery<
    MovementsPage,
    ApiError,
    InfiniteData<MovementsPage, string | undefined>,
    readonly ['goals', string, 'movements', number],
    string | undefined
  >({
    queryKey: [...goalMovementsQueryKey(goalId), limit] as const,
    enabled: Boolean(goalId),
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      savingsService.listGoalMovements(
        goalId,
        pageParam ? { cursor: pageParam, limit } : { limit },
        signal,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
}
