import type { LoginRequest, SessionResponse } from '@nova/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import type { ApiError } from '../../../lib/http-client.ts';
import { SESSION_QUERY_KEY } from './useSession.ts';

/** Mutación de inicio de sesión (`POST /api/v1/auth/login`) que hidrata `['session']`. */
export function useLogin() {
  const { authService } = useAuthServices();
  const queryClient = useQueryClient();

  return useMutation<SessionResponse, ApiError, LoginRequest>({
    mutationFn: (input) => authService.login(input),
    onSuccess: (session) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
  });
}
