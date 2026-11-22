import type { SessionResponse } from '@nova/shared';
import { useQuery } from '@tanstack/react-query';

import { ApiError } from '../../../lib/api-client.ts';
import { getSession } from '../api.ts';

export const SESSION_QUERY_KEY = ['session'] as const;

/**
 * Consulta la sesión vigente (`['session']`). Un 401 (`UNAUTHENTICATED` o `SESSION_EXPIRED`)
 * equivale a «sin sesión» (`null`), mientras que un fallo de red o 5xx se expone como error.
 */
export function useSession() {
  return useQuery<SessionResponse | null, ApiError>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async ({ signal }) => {
      try {
        return await getSession(signal);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
