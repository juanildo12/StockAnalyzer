'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { applyTheme } from '@/src/utils/webTheme';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  version: number;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggle: () => {}, version: 0 });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    const preferred = stored || 'dark';
    setTheme(preferred);
    applyTheme(preferred);
    document.documentElement.setAttribute('data-theme', preferred);
  }, []);

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      document.documentElement.setAttribute('data-theme', next);
      applyTheme(next);
      return next;
    });
    setVersion(v => v + 1);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, version }}>
      {children}
    </ThemeContext.Provider>
  );
}
