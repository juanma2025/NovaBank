import { MOVEMENTS_PAGE_SIZE, type MovementsPage } from '@nova/shared';
import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';

export const MOVEMENTS_QUERY_KEY = ['movements'] as const;

export function useMovements(limit = MOVEMENTS_PAGE_SIZE) {
  const { accountService } = useAuthServices();

  return useInfiniteQuery<
    MovementsPage,
    ApiError,
    InfiniteData<MovementsPage, string | undefined>,
    readonly ['movements', number],
    string | undefined
  >({
    queryKey: [...MOVEMENTS_QUERY_KEY, limit] as const,
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      accountService.listMyMovements(pageParam ? { cursor: pageParam, limit } : { limit }, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
}
