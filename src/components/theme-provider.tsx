import { useEffect, useState, type ReactNode } from 'react';
import {
  parseTheme,
  ThemeContext,
  themeStorageKey,
  type Theme,
} from '@/components/theme-context';

const mediaQuery = '(prefers-color-scheme: dark)';
function storedTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(themeStorageKey));
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState(storedTheme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(mediaQuery).matches,
  );
  const resolvedTheme =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const media = window.matchMedia(mediaQuery);
    const onChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey || event.key === null)
        updateTheme(parseTheme(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  function setTheme(value: Theme) {
    updateTheme(value);
    try {
      localStorage.setItem(themeStorageKey, value);
    } catch {
      // Theme changes still work when browser storage is unavailable.
    }
  }
  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
