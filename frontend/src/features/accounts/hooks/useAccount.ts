import type { AccountSummary } from '@nova/shared';
import { useQuery } from '@tanstack/react-query';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';

export const ACCOUNT_QUERY_KEY = ['account'] as const;

export function useAccount() {
  const { accountService } = useAuthServices();

  return useQuery<AccountSummary, ApiError>({
    queryKey: ACCOUNT_QUERY_KEY,
    queryFn: ({ signal }) => accountService.getMyAccount(signal),
    staleTime: 30_000,
    retry: false,
  });
}
