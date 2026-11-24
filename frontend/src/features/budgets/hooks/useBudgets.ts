import {
  type BudgetAlert,
  type BudgetAlertList,
  type BudgetCategory,
  type BudgetMonth,
  type BudgetTransfer,
  type BudgetTransfersPage,
  MOVEMENTS_PAGE_SIZE,
} from '@nova/shared';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';

export const BUDGET_QUERY_KEY = ['budget'] as const;
export const BUDGET_ALERTS_QUERY_KEY = ['budget-alerts'] as const;
export const BUDGET_TRANSFERS_QUERY_KEY = ['budget-transfers'] as const;

export function useBudgetMonth(month?: string) {
  const { budgetService } = useAuthServices();

  return useQuery<BudgetMonth, ApiError>({
    queryKey: [...BUDGET_QUERY_KEY, month ?? 'current'] as const,
    queryFn: ({ signal }) => budgetService.getMonth(month, signal),
    retry: false,
  });
}

export function useBudgetAlerts(enabled = true) {
  const { budgetService } = useAuthServices();

  return useQuery<BudgetAlertList, ApiError>({
    queryKey: BUDGET_ALERTS_QUERY_KEY,
    enabled,
    queryFn: ({ signal }) => budgetService.listAlerts(signal),
    retry: false,
  });
}

export function useSetBudgetLimit() {
  const { budgetService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<BudgetMonth, ApiError, { category: BudgetCategory; monthlyLimit: number }>({
    mutationFn: ({ category, monthlyLimit }) => budgetService.setLimit(category, monthlyLimit),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: BUDGET_ALERTS_QUERY_KEY }),
      ]);
    },
  });
}

export function useRemoveBudgetLimit() {
  const { budgetService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<BudgetMonth, ApiError, BudgetCategory>({
    mutationFn: (category) => budgetService.removeLimit(category),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: BUDGET_ALERTS_QUERY_KEY }),
      ]);
    },
  });
}

export function useMarkAlertSeen() {
  const { budgetService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<BudgetAlert, ApiError, string>({
    mutationFn: (alertId) => budgetService.markAlertSeen(alertId),
    onSuccess: (updated) => {
      queryClient.setQueryData<BudgetAlertList>(BUDGET_ALERTS_QUERY_KEY, (prev) => {
        if (!prev) return prev;
        return {
          items: prev.items.map((item) => (item.id === updated.id ? updated : item)),
        };
      });
    },
  });
}

export function useBudgetTransfers(month?: string, limit = MOVEMENTS_PAGE_SIZE) {
  const { budgetService } = useAuthServices();

  return useInfiniteQuery<
    BudgetTransfersPage,
    ApiError,
    InfiniteData<BudgetTransfersPage, string | undefined>,
    readonly ['budget-transfers', string, number],
    string | undefined
  >({
    queryKey: [...BUDGET_TRANSFERS_QUERY_KEY, month ?? 'current', limit] as const,
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      budgetService.listTransfers(
        {
          ...(month ? { month } : {}),
          ...(pageParam ? { cursor: pageParam } : {}),
          limit,
        },
        signal,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
}

export function useSetTransferCategory() {
  const { budgetService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<BudgetTransfer, ApiError, { transactionId: string; category: BudgetCategory }>(
    {
      mutationFn: ({ transactionId, category }) =>
        budgetService.setTransferCategory(transactionId, category),
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: BUDGET_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: BUDGET_ALERTS_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: BUDGET_TRANSFERS_QUERY_KEY }),
        ]);
      },
    },
  );
}
