import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { Spinner } from '../components/Spinner.tsx';
import { useSession } from '../features/auth/hooks/useSession.ts';
import { APP_MESSAGES } from '../lib/messages.ts';

export interface RequireAuthProps {
  children?: ReactNode;
}

/** Protege rutas privadas: sin sesión redirige a `/ingresar?redirect=<ruta actual>` (FR-018). */
export function RequireAuth({ children }: RequireAuthProps) {
  const { data: session, isPending } = useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="nova-canvas flex min-h-dvh items-center justify-center">
        <Spinner size="md" label={APP_MESSAGES.loadingSession} className="text-brand" />
      </div>
    );
  }

  if (!session) {
    const target = `${location.pathname}${location.search}`;
    const redirectParam = encodeURIComponent(target);
    return <Navigate to={`/ingresar?redirect=${redirectParam}`} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
