import { Moon, Sun } from 'lucide-react';

import { THEME_MESSAGES } from '../lib/messages.ts';
import { useTheme } from '../lib/use-theme.ts';

export interface ThemeToggleProps {
  className?: string;
}

/** Selector accesible de modo claro / oscuro (≥ 44 px, `09-icon-swap`). */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? THEME_MESSAGES.switchToLight : THEME_MESSAGES.switchToDark;

  return (
    <button
      type="button"
      aria-pressed={isDark}
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      className={`inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface/85 text-text-secondary shadow-[var(--shadow-control)] transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-surface-subtle hover:text-text ${className}`}
    >
      <span
        aria-hidden="true"
        className="t-icon-swap h-[18px] w-[18px]"
        data-state={isDark ? 'b' : 'a'}
      >
        <Moon className="t-icon h-[18px] w-[18px]" data-slot="a" />
        <Sun className="t-icon h-[18px] w-[18px]" data-slot="b" />
      </span>
    </button>
  );
}
