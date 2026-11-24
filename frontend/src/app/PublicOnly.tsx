import type { ReactNode } from 'react';
import { Navigate, Outlet, useSearchParams } from 'react-router';

import { Spinner } from '../components/Spinner.tsx';
import { useSession } from '../features/auth/hooks/useSession.ts';
import { APP_MESSAGES } from '../lib/messages.ts';
import { safeRedirect } from '../lib/safe-redirect.ts';

export interface PublicOnlyProps {
  children?: ReactNode;
}

/** Rutas solo disponibles sin sesión iniciada: con sesión redirige a `?redirect=` seguro o `/inicio`. */
export function PublicOnly({ children }: PublicOnlyProps) {
  const { data: session, isPending } = useSession();
  const [searchParams] = useSearchParams();

  if (isPending) {
    return (
      <div className="nova-canvas flex min-h-dvh items-center justify-center">
        <Spinner size="md" label={APP_MESSAGES.loadingSession} className="text-brand" />
      </div>
    );
  }

  if (session) {
    const target = safeRedirect(searchParams.get('redirect'), '/inicio');
    return <Navigate to={target} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
