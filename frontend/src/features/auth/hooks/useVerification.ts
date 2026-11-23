import {
  PRIVACY_POLICY_VERSION,
  type VerificationPurpose,
  type VerificationState,
} from '@nova/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import { ApiError } from '../../../lib/http-client.ts';

export function verificationQueryKey(purpose: VerificationPurpose) {
  return ['verification', purpose] as const;
}

/**
 * Orquesta la consulta `['verification', purpose]` (para retomar el paso tras recargar, FR-009a)
 * y las mutaciones `start` y `verify` compartidas entre registro y recuperación.
 */
export function useVerification(purpose: VerificationPurpose) {
  const { authService } = useAuthServices();
  const queryClient = useQueryClient();
  const queryKey = verificationQueryKey(purpose);

  const query = useQuery<VerificationState | null, ApiError>({
    queryKey,
    queryFn: async ({ signal }) => {
      try {
        const state = await authService.getVerification(signal);
        return state.purpose === purpose ? state : null;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const startMutation = useMutation<VerificationState, ApiError, { email: string }>({
    mutationFn: ({ email }) =>
      purpose === 'registration'
        ? authService.startRegistration({ email, acceptedPolicyVersion: PRIVACY_POLICY_VERSION })
        : authService.startPasswordReset({ email }),
    onSuccess: (nextState) => {
      queryClient.setQueryData(queryKey, nextState);
    },
  });

  const verifyMutation = useMutation<VerificationState, ApiError, { code: string }>({
    mutationFn: ({ code }) => authService.verifyEmail({ code }),
    onSuccess: (nextState) => {
      queryClient.setQueryData(queryKey, nextState);
    },
  });

  function setVerificationState(nextState: VerificationState | null): void {
    queryClient.setQueryData(queryKey, nextState);
  }

  return {
    query,
    startMutation,
    verifyMutation,
    setVerificationState,
  };
}
