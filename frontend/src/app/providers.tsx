import type { SessionEndReason } from '@nova/shared';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { Alert } from '../components/Alert.tsx';
import { NovaMark } from '../components/AppHeader.tsx';
import { Button } from '../components/Button.tsx';
import { GlassCard } from '../components/GlassCard.tsx';
import { Spinner } from '../components/Spinner.tsx';
import { InactivityDialog } from '../features/auth/components/InactivityDialog.tsx';
import { useIdleTimer } from '../features/auth/hooks/useIdleTimer.ts';
import { SESSION_QUERY_KEY, useSession } from '../features/auth/hooks/useSession.ts';
import { resetLastServerContactAt, setOnSessionExpired } from '../lib/api-client.ts';
import { APP_MESSAGES } from '../lib/messages.ts';

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export interface AppProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function AppProviders({ children, queryClient: externalClient }: AppProvidersProps) {
  const [internalClient] = useState(() => externalClient ?? createAppQueryClient());
  return <QueryClientProvider client={internalClient}>{children}</QueryClientProvider>;
}

function buildExpiredLoginUrl(
  reason: SessionEndReason | 'expirada' | undefined,
  currentPath: string,
): string {
  const params = new URLSearchParams();
  params.set('motivo', reason === 'idle' ? 'inactividad' : 'expirada');
  if (currentPath && !currentPath.startsWith('/ingresar')) {
    params.set('redirect', currentPath);
  }
  return `/ingresar?${params.toString()}`;
}

export interface SessionProviderProps {
  children: ReactNode;
}

/**
 * Conecta `SESSION_EXPIRED` del cliente HTTP, el temporizador de inactividad (`useIdleTimer`)
 * y el aviso modal (`InactivityDialog`) con la caché de TanStack Query y la navegación.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();

  const handleSessionTermination = useCallback(
    (reason: 'idle' | 'expirada' | 'logout') => {
      resetLastServerContactAt();
      queryClient.clear();
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      if (reason === 'logout') {
        void navigate('/ingresar', { replace: true });
        return;
      }
      const currentPath = `${location.pathname}${location.search}`;
      void navigate(buildExpiredLoginUrl(reason, currentPath), { replace: true });
    },
    [location.pathname, location.search, navigate, queryClient],
  );

  useEffect(() => {
    setOnSessionExpired((reason) => {
      handleSessionTermination(reason === 'idle' ? 'idle' : 'expirada');
    });

    return () => {
      setOnSessionExpired(null);
    };
  }, [handleSessionTermination]);

  const idle = useIdleTimer({
    session: session ?? null,
    onSessionEnded: handleSessionTermination,
  });

  return (
    <>
      {children}
      <InactivityDialog
        open={idle.warningOpen}
        secondsLeft={idle.secondsLeft}
        isRefreshing={idle.isRefreshing}
        onStayConnected={() => {
          void idle.stayConnected();
        }}
        onLogoutNow={() => {
          void idle.logoutNow();
        }}
      />
    </>
  );
}

/**
 * Pantalla de arranque mientras se resuelve la consulta inicial `['session']`. Si no hay
 * conexión con la API, muestra una alerta con «Reintentar» (plan.md · Arranque de la app).
 */
export function AppStartupGate({ children }: { children: ReactNode }) {
  const { isPending, isError, error, refetch, isFetching } = useSession();

  if (isPending) {
    return (
      <div className="nova-canvas flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
        <div className="flex items-center gap-2.5 text-xl font-semibold tracking-[-0.02em] text-text">
          <NovaMark className="h-9 w-9" />
          <span>{APP_MESSAGES.brandName}</span>
        </div>
        <Spinner size="md" label={APP_MESSAGES.loadingSession} className="text-brand" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="nova-canvas flex min-h-dvh flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px] space-y-6">
          <div className="flex items-center justify-center gap-2.5 text-xl font-semibold tracking-[-0.02em] text-text">
            <NovaMark className="h-8 w-8" />
            <span>{APP_MESSAGES.brandName}</span>
          </div>
          <GlassCard>
            <Alert
              variant="error"
              action={
                <Button
                  variant="secondary"
                  loading={isFetching}
                  onClick={() => {
                    void refetch();
                  }}
                >
                  {APP_MESSAGES.retry}
                </Button>
              }
            >
              {error.message}
            </Alert>
          </GlassCard>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
