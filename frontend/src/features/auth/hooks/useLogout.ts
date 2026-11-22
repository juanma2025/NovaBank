import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { resetLastServerContactAt } from '../../../lib/api-client.ts';
import { logout } from '../api.ts';
import { broadcastSessionMessage } from '../session-channel.ts';
import { SESSION_QUERY_KEY } from './useSession.ts';

/**
 * Cierra sesión en el backend (`POST /auth/logout`), limpia la caché de consultas, difunde el
 * cierre a las demás pestañas y navega a `/ingresar` (T067, FR-017).
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      try {
        await logout();
      } catch {
        // Incluso ante fallo de red, el cierre limpia el estado local y redirige.
      }
    },
    onSettled: () => {
      resetLastServerContactAt();
      broadcastSessionMessage({ type: 'logout', reason: 'logout' });
      queryClient.clear();
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      void navigate('/ingresar', { replace: true });
    },
  });
}
