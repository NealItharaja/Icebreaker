import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, shadow, shadowDark, Tokens } from './tokens';
import { loadTheme, saveTheme } from '../store/persist';

type ThemeCtx = {
  t: Tokens;
  dark: boolean;
  sh: typeof shadow;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  // null = follow system until the user explicitly toggles
  const [pref, setPref] = useState<'light' | 'dark' | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadTheme().then((v) => {
      setPref(v);
      setLoaded(true);
    });
  }, []);

  const isDark = (pref ?? system) === 'dark';

  const toggle = useCallback(() => {
    setPref(() => {
      const next = isDark ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  }, [isDark]);

  const value = useMemo<ThemeCtx>(
    () => ({ t: isDark ? dark : light, dark: isDark, sh: isDark ? shadowDark : shadow, toggle }),
    [isDark, toggle],
  );

  if (!loaded) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme outside ThemeProvider');
  return v;
}
