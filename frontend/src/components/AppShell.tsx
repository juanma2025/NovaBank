import { LayoutGrid, LogOut, User, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { useLogout } from '../features/auth/hooks/useLogout.ts';
import { useSession } from '../features/auth/hooks/useSession.ts';
import { APP_MESSAGES, NAV_MESSAGES } from '../lib/messages.ts';
import { Button } from './Button.tsx';
import { DESKTOP_NAV_ITEMS, MOBILE_MORE_ITEMS, MOBILE_PRIMARY_ITEMS } from './nav-items.ts';
import { NovaMark } from './NovaMark.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';

export interface AppShellProps {
  children: ReactNode;
}

function isRouteActive(pathname: string, target: string): boolean {
  return pathname === target || pathname.startsWith(`${target}/`);
}

export function AppShell({ children }: AppShellProps) {
  const { pathname } = useLocation();
  const { data: session } = useSession();
  const logoutMutation = useLogout();
  const [moreOpen, setMoreOpen] = useState(false);
  const pillRef = useRef<HTMLSpanElement>(null);
  const mobileTabRefs = useRef<(HTMLElement | null)[]>([]);
  const mountedRef = useRef(false);

  const inMoreMenu = MOBILE_MORE_ITEMS.some((item) => isRouteActive(pathname, item.to));
  const primaryIdx = MOBILE_PRIMARY_ITEMS.findIndex((item) => isRouteActive(pathname, item.to));
  const activeMobileIndex =
    primaryIdx >= 0 ? primaryIdx : inMoreMenu ? MOBILE_PRIMARY_ITEMS.length : -1;

  const syncMobilePill = useCallback(
    (animate: boolean) => {
      const pill = pillRef.current;
      const activeTab = activeMobileIndex >= 0 ? mobileTabRefs.current[activeMobileIndex] : null;
      if (!pill) return;

      if (!activeTab) {
        pill.style.opacity = '0';
        return;
      }

      const apply = () => {
        pill.style.opacity = '1';
        pill.style.transform = `translateX(${activeTab.offsetLeft}px)`;
        pill.style.width = `${activeTab.offsetWidth}px`;
      };

      if (!animate) {
        const previous = pill.style.transition;
        pill.style.transition = 'none';
        apply();
        void pill.offsetWidth;
        pill.style.transition = previous;
      } else {
        apply();
      }
    },
    [activeMobileIndex],
  );

  useLayoutEffect(() => {
    syncMobilePill(mountedRef.current);
    mountedRef.current = true;
  }, [syncMobilePill]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleResize = () => syncMobilePill(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncMobilePill]);

  return (
    <div className="nova-canvas flex min-h-dvh flex-col lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      {/* Barra superior móvil (< 1024 px) */}
      <header className="nova-glass-header sticky top-0 z-20 flex min-h-15 items-center justify-between gap-2 px-3 sm:px-6 lg:hidden">
        <Link
          to="/inicio"
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] pr-2 text-lg font-semibold tracking-[-0.02em] text-text"
        >
          <NovaMark className="h-7 w-7 shrink-0" />
          <span>{APP_MESSAGES.brandName}</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/perfil"
            aria-label={NAV_MESSAGES.profile}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface/85 text-text-secondary shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle hover:text-text"
          >
            <User aria-hidden="true" className="h-[18px] w-[18px]" />
          </Link>
          <ThemeToggle />
          {session && (
            <Button
              variant="secondary"
              loading={logoutMutation.isPending}
              loadingLabel={APP_MESSAGES.loggingOut}
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="sr-only sm:not-sr-only">{APP_MESSAGES.logout}</span>
            </Button>
          )}
        </div>
      </header>

      {/* Menú lateral escritorio (≥ 1024 px) */}
      <aside className="nova-glass-sidebar sticky top-0 hidden h-dvh flex-col justify-between overflow-y-auto p-5 lg:flex">
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-2 px-2">
            <div className="space-y-1">
              <Link
                to="/inicio"
                className="inline-flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] text-xl font-semibold tracking-[-0.025em] text-text transition-opacity duration-[var(--duration-quick)] hover:opacity-85"
              >
                <NovaMark className="h-8 w-8 shrink-0" />
                <span>{APP_MESSAGES.brandName}</span>
              </Link>
              <p className="text-xs text-text-muted">{NAV_MESSAGES.accountSectionLabel}</p>
            </div>
            <ThemeToggle />
          </div>

          <nav aria-label={NAV_MESSAGES.mainNavLabel} className="space-y-1">
            {DESKTOP_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isRouteActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3.5 py-2 text-[15px] font-medium transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] ${
                    active
                      ? 'bg-brand-soft font-semibold text-brand-text'
                      : 'text-text-secondary hover:bg-surface-subtle hover:text-text'
                  }`}
                >
                  <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {session && (
          <div className="space-y-3 border-t border-border pt-4">
            <Link
              to="/perfil"
              className="block min-w-0 rounded-[var(--radius-md)] px-2 py-1.5 transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle"
            >
              <p className="truncate text-sm font-semibold text-text">{session.user.fullName}</p>
              <p className="truncate text-xs text-text-muted">{session.user.email}</p>
            </Link>
            <Button
              variant="secondary"
              fullWidth
              loading={logoutMutation.isPending}
              loadingLabel={APP_MESSAGES.loggingOut}
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{APP_MESSAGES.logout}</span>
            </Button>
          </div>
        )}
      </aside>

      <main
        className="t-panel-slide mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:py-10"
        data-open="true"
      >
        {children}
      </main>

      {/* Menú desplegable móvil «Más» (escalable sin desborde desde 360 px) */}
      {moreOpen && (
        <div
          className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-md lg:hidden"
          role="region"
          aria-label={NAV_MESSAGES.mobileMoreMenuLabel}
        >
          <div className="nova-glass t-surface-enter grid grid-cols-2 gap-2 rounded-[var(--radius-xl)] p-3">
            {MOBILE_MORE_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isRouteActive(pathname, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors duration-[var(--duration-quick)] ${
                    active
                      ? 'bg-brand-soft font-semibold text-brand-text'
                      : 'text-text-secondary hover:bg-surface-subtle hover:text-text'
                  }`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra inferior flotante móvil (5 accesos ≤ 360 px sin desborde) */}
      <nav
        aria-label={NAV_MESSAGES.mobileNavLabel}
        className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-md lg:hidden"
      >
        <div className="nova-glass t-tabs grid w-full grid-cols-5 rounded-[var(--radius-pill)] p-1">
          <span ref={pillRef} aria-hidden="true" className="t-tabs-pill" />
          {MOBILE_PRIMARY_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const active = isRouteActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                ref={(el) => {
                  mobileTabRefs.current[index] = el;
                }}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`t-tab flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-pill)] px-1 py-1.5 text-[10px] font-medium ${
                  active ? 'font-semibold text-brand-text' : 'text-text-secondary hover:text-text'
                }`}
              >
                <Icon aria-hidden="true" className="h-[17px] w-[17px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            ref={(el) => {
              mobileTabRefs.current[MOBILE_PRIMARY_ITEMS.length] = el;
            }}
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((prev) => !prev)}
            className={`t-tab flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[var(--radius-pill)] px-1 py-1.5 text-[10px] font-medium ${
              inMoreMenu || moreOpen
                ? 'font-semibold text-brand-text'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            {moreOpen ? (
              <X aria-hidden="true" className="h-[17px] w-[17px] shrink-0" />
            ) : (
              <LayoutGrid aria-hidden="true" className="h-[17px] w-[17px] shrink-0" />
            )}
            <span className="truncate">{NAV_MESSAGES.mobileMoreLabel}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
