import type { TransferLimits } from '@nova/shared';
import { useQuery } from '@tanstack/react-query';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';

export const TRANSFER_LIMITS_QUERY_KEY = ['transfer-limits'] as const;

export function useTransferLimits() {
  const { transferService } = useAuthServices();

  return useQuery<TransferLimits, ApiError>({
    queryKey: TRANSFER_LIMITS_QUERY_KEY,
    queryFn: ({ signal }) => transferService.getLimits(signal),
    retry: false,
  });
}
