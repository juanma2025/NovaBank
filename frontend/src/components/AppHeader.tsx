import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useLogout } from '../features/auth/hooks/useLogout.ts';
import { useSession } from '../features/auth/hooks/useSession.ts';
import { APP_MESSAGES } from '../lib/messages.ts';
import { Button } from './Button.tsx';
import { NovaMark } from './NovaMark.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

export interface AppHeaderProps {
  actions?: ReactNode;
}

export function AppHeader({ actions }: AppHeaderProps) {
  const { data: session } = useSession();
  const logoutMutation = useLogout();

  return (
    <header className="nova-glass-header sticky top-0 z-20 w-full">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] pr-2 text-lg font-semibold tracking-[-0.02em] text-text transition-opacity duration-[var(--duration-quick)] hover:opacity-85"
        >
          <NovaMark className="h-7 w-7 shrink-0" />
          <span>{APP_MESSAGES.brandName}</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {actions}
          {session && (
            <Button
              variant="secondary"
              loading={logoutMutation.isPending}
              loadingLabel={APP_MESSAGES.loggingOut}
              onClick={() => {
                logoutMutation.mutate();
              }}
            >
              <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{APP_MESSAGES.logout}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
