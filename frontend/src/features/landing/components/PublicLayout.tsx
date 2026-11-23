import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';

import { NovaMark } from '../../../components/NovaMark.tsx';
import { ThemeToggle } from '../../../components/ThemeToggle.tsx';
import { APP_MESSAGES, LANDING_MESSAGES } from '../../../lib/messages.ts';

export interface PublicLayoutProps {
  children: ReactNode;
}

const PUBLIC_NAV_ITEMS = [
  { to: '/', label: LANDING_MESSAGES.nav.home },
  { to: '/caracteristicas', label: LANDING_MESSAGES.nav.features },
  { to: '/estudiantes', label: LANDING_MESSAGES.nav.students },
] as const;

/**
 * Shell común para las rutas públicas (`/`, `/caracteristicas`, `/estudiantes`).
 * Concentra en un único navbar superior fijo las rutas públicas (`16-tabs-sliding`),
 * el selector de tema y los botones únicos «Iniciar sesión» y «Crear cuenta».
 */
export function PublicLayout({ children }: PublicLayoutProps) {
  const { pathname } = useLocation();
  const { nav, footer } = LANDING_MESSAGES;
  const pillRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const mountedRef = useRef(false);

  const activeIndex = PUBLIC_NAV_ITEMS.findIndex((item) => item.to === pathname);

  const syncPill = useCallback(
    (animate: boolean) => {
      const pill = pillRef.current;
      const activeTab = activeIndex >= 0 ? tabRefs.current[activeIndex] : null;
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
    [activeIndex],
  );

  useLayoutEffect(() => {
    syncPill(mountedRef.current);
    mountedRef.current = true;
  }, [syncPill]);

  useEffect(() => {
    const handleResize = () => syncPill(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncPill]);

  return (
    <div className="nova-canvas flex min-h-dvh flex-col">
      <header className="nova-glass-header sticky top-0 z-30 w-full">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 px-3 py-2 sm:px-6 md:grid-cols-[auto_1fr_auto] md:py-2.5 lg:px-10">
          <Link
            to="/"
            className="order-1 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-sm)] pr-1 text-base font-semibold tracking-[-0.02em] text-text transition-opacity duration-[var(--duration-quick)] hover:opacity-85 sm:gap-2.5 sm:text-lg"
          >
            <NovaMark className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
            <span>{APP_MESSAGES.brandName}</span>
          </Link>

          <nav
            aria-label={nav.ariaLabel}
            className="order-3 col-span-2 flex justify-center border-t border-border pt-1.5 md:order-2 md:col-span-1 md:border-t-0 md:pt-0"
          >
            <div className="t-tabs grid w-full max-w-sm grid-cols-3 rounded-[var(--radius-pill)] border border-border bg-surface/85 p-1 md:inline-flex md:w-auto md:max-w-none">
              <span ref={pillRef} aria-hidden="true" className="t-tabs-pill" />
              {PUBLIC_NAV_ITEMS.map((item, index) => {
                const active = item.to === pathname;
                return (
                  <Link
                    key={item.to}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    className={`t-tab inline-flex min-h-11 items-center justify-center rounded-[var(--radius-pill)] px-2 text-center text-xs font-medium whitespace-nowrap md:px-4 md:text-sm ${
                      active
                        ? 'font-semibold text-brand-text'
                        : 'text-text-secondary hover:text-text'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="order-2 flex items-center justify-end gap-1.5 sm:gap-2 md:order-3">
            <ThemeToggle />
            <Link
              to="/ingresar"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface/90 px-2.5 text-xs font-semibold whitespace-nowrap text-text shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-surface-subtle sm:px-4 sm:text-sm"
            >
              {nav.login}
            </Link>
            <Link
              to="/registro"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-brand px-2.5 text-xs font-semibold whitespace-nowrap text-on-brand shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] hover:bg-brand-hover active:bg-brand-active sm:px-4 sm:text-sm"
            >
              {nav.register}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div key={pathname} className="t-surface-enter">
          {children}
        </div>
      </main>

      <footer className="border-t border-border bg-surface-glass-strong/75">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-[-0.02em] text-text">
              <NovaMark className="h-5 w-5 shrink-0" />
              <span>{APP_MESSAGES.brandName}</span>
            </div>
            <p className="text-xs leading-relaxed text-text-muted">{footer.academicNote}</p>
          </div>

          <Link
            to="/privacidad"
            className="inline-flex min-h-11 shrink-0 items-center self-start rounded-[var(--radius-sm)] px-2 text-sm font-medium text-text-secondary transition-colors duration-[var(--duration-quick)] hover:text-text sm:self-center"
          >
            {footer.privacy}
          </Link>
        </div>
      </footer>
    </div>
  );
}
