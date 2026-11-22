import type { LoginRequest, SessionResponse } from '@nova/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ApiError } from '../../../lib/api-client.ts';
import { login } from '../api.ts';
import { SESSION_QUERY_KEY } from './useSession.ts';

/** Mutación de inicio de sesión (`POST /api/v1/auth/login`) que hidrata `['session']`. */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation<SessionResponse, ApiError, LoginRequest>({
    mutationFn: login,
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
  });
}
