import { type Card, type CardList, type CardPaymentsPage, MOVEMENTS_PAGE_SIZE } from '@nova/shared';
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';

export const CARDS_QUERY_KEY = ['cards'] as const;

export function cardPaymentsQueryKey(cardId: string) {
  return ['cards', cardId, 'payments'] as const;
}

export function useCards() {
  const { cardService } = useAuthServices();

  return useQuery<CardList, ApiError>({
    queryKey: CARDS_QUERY_KEY,
    queryFn: ({ signal }) => cardService.listCards(signal),
    retry: false,
  });
}

export function useIssueCard() {
  const { cardService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Card, ApiError, string>({
    mutationFn: (nickname) => cardService.issueCard(nickname),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY });
    },
  });
}

export function useRenameCard() {
  const { cardService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Card, ApiError, { cardId: string; nickname: string }>({
    mutationFn: ({ cardId, nickname }) => cardService.renameCard(cardId, nickname),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY });
    },
  });
}

export function useSetCardFrozen() {
  const { cardService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Card, ApiError, { cardId: string; freeze: boolean }>({
    mutationFn: ({ cardId, freeze }) =>
      freeze ? cardService.freezeCard(cardId) : cardService.unfreezeCard(cardId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY });
    },
  });
}

export function useCancelCard() {
  const { cardService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<Card, ApiError, string>({
    mutationFn: (cardId) => cardService.cancelCard(cardId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY });
    },
  });
}

export function useCardPayments(cardId: string, limit = MOVEMENTS_PAGE_SIZE) {
  const { cardService } = useAuthServices();

  return useInfiniteQuery<
    CardPaymentsPage,
    ApiError,
    InfiniteData<CardPaymentsPage, string | undefined>,
    readonly ['cards', string, 'payments', number],
    string | undefined
  >({
    queryKey: [...cardPaymentsQueryKey(cardId), limit] as const,
    enabled: Boolean(cardId),
    initialPageParam: undefined,
    queryFn: ({ pageParam, signal }) =>
      cardService.listCardPayments(
        cardId,
        pageParam ? { cursor: pageParam, limit } : { limit },
        signal,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
  });
}
