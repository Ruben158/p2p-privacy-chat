import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors, { ColorPalette, THEMES, ThemeId, ThemeMode } from '@/constants/colors';

const STORAGE_THEME_KEY = 'p2p_messenger_theme_id_v1';
const STORAGE_MODE_KEY = 'p2p_messenger_theme_mode_v1';

interface ThemeContextValue {
  themeId: ThemeId;
  themeMode: ThemeMode;
  palette: ColorPalette;
  setThemeId: (id: ThemeId) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: 'emerald',
  themeMode: 'dark',
  palette: THEMES.emerald.dark,
  setThemeId: () => {},
  setThemeMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('emerald');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      AsyncStorage.getItem(STORAGE_THEME_KEY),
      AsyncStorage.getItem(STORAGE_MODE_KEY),
    ])
      .then(([savedTheme, savedMode]) => {
        if (!mounted) return;
        if (savedTheme && savedTheme in THEMES) {
          setThemeIdState(savedTheme as ThemeId);
        }
        if (savedMode === 'light' || savedMode === 'dark') {
          setThemeModeState(savedMode as ThemeMode);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    void AsyncStorage.setItem(STORAGE_THEME_KEY, id).catch(() => {});
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    void AsyncStorage.setItem(STORAGE_MODE_KEY, mode).catch(() => {});
  }, []);

  const palette = THEMES[themeId]?.[themeMode] ?? THEMES.emerald.dark;

  const value = useMemo(
    () => ({
      themeId,
      themeMode,
      palette,
      setThemeId,
      setThemeMode,
    }),
    [themeId, themeMode, palette, setThemeId, setThemeMode],
  );

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useThemeSettings() {
  const ctx = useContext(ThemeContext);
  return {
    themeId: ctx.themeId,
    themeMode: ctx.themeMode,
    setThemeId: ctx.setThemeId,
    setThemeMode: ctx.setThemeMode,
  };
}

export function useColors() {
  const ctx = useContext(ThemeContext);
  return {
    ...ctx.palette,
    radius: colors.radius,
    themeId: ctx.themeId,
    themeMode: ctx.themeMode,
  };
}
