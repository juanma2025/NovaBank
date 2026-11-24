import type { TopupLimits } from '@nova/shared';
import { useQuery } from '@tanstack/react-query';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';

export const TOPUP_LIMITS_QUERY_KEY = ['topups', 'limits'] as const;

export function useTopupLimits() {
  const { topupService } = useAuthServices();

  return useQuery<TopupLimits, ApiError>({
    queryKey: TOPUP_LIMITS_QUERY_KEY,
    queryFn: ({ signal }) => topupService.getTopupLimits(signal),
    retry: false,
  });
}
