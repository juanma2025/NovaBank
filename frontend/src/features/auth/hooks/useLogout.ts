import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useAuthServices } from '../../../app/auth-services.context.ts';
import { SESSION_QUERY_KEY } from './useSession.ts';

/**
 * Cierra sesión en el backend (`POST /auth/logout`), limpia la caché de consultas, difunde el
 * cierre a las demás pestañas mediante `SessionBroadcaster` y navega a `/ingresar` (T067, FR-017).
 */
export function useLogout() {
  const { httpClient, authService, createBroadcaster } = useAuthServices();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      try {
        await authService.logout();
      } catch {
        // Incluso ante fallo de red, el cierre limpia el estado local y redirige.
      }
    },
    onSettled: () => {
      httpClient.resetLastServerContactAt();
      const broadcaster = createBroadcaster();
      broadcaster.publish({ type: 'logout', reason: 'logout' });
      broadcaster.dispose();
      queryClient.clear();
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      void navigate('/ingresar', { replace: true });
    },
  });
}
