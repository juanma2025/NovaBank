import { useCallback, useEffect, useState } from 'react';

import { useAuthServices } from '../app/auth-services.context.ts';
import type { ThemeMode } from './theme-controller.ts';

export interface UseThemeResult {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const { themeController } = useAuthServices();
  const [theme, setThemeState] = useState<ThemeMode>(() => themeController.getTheme());

  useEffect(() => {
    setThemeState(themeController.apply());
    return themeController.subscribe((next) => {
      setThemeState(next);
    });
  }, [themeController]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      themeController.setTheme(mode);
    },
    [themeController],
  );

  const toggleTheme = useCallback(() => {
    themeController.toggle();
  }, [themeController]);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  };
}
