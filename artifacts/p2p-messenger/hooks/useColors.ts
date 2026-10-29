import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors, { THEMES, ThemeId, ThemeMode } from '@/constants/colors';

const STORAGE_THEME_KEY = 'p2p_messenger_theme_id_v1';
const STORAGE_MODE_KEY = 'p2p_messenger_theme_mode_v1';

let currentThemeId: ThemeId = 'emerald';
let currentThemeMode: ThemeMode = 'dark';
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

async function initThemeFromStorage() {
  if (initialized) return;
  initialized = true;
  try {
    const [savedTheme, savedMode] = await Promise.all([
      AsyncStorage.getItem(STORAGE_THEME_KEY),
      AsyncStorage.getItem(STORAGE_MODE_KEY),
    ]);
    let changed = false;
    if (savedTheme && savedTheme in THEMES) {
      currentThemeId = savedTheme as ThemeId;
      changed = true;
    }
    if (savedMode === 'light' || savedMode === 'dark') {
      currentThemeMode = savedMode;
      changed = true;
    }
    if (changed) notify();
  } catch {
    // ignore storage errors
  }
}

export function setAppTheme(themeId: ThemeId) {
  currentThemeId = themeId;
  notify();
  void AsyncStorage.setItem(STORAGE_THEME_KEY, themeId).catch(() => {});
}

export function setAppThemeMode(mode: ThemeMode) {
  currentThemeMode = mode;
  notify();
  void AsyncStorage.setItem(STORAGE_MODE_KEY, mode).catch(() => {});
}

export function useThemeSettings() {
  const [, setTick] = useState(0);

  useEffect(() => {
    void initThemeFromStorage();
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    themeId: currentThemeId,
    themeMode: currentThemeMode,
    setThemeId: setAppTheme,
    setThemeMode: setAppThemeMode,
  };
}

export function useColors() {
  const { themeId, themeMode } = useThemeSettings();
  const palette = THEMES[themeId]?.[themeMode] ?? THEMES.emerald.dark;
  return {
    ...palette,
    radius: colors.radius,
    themeId,
    themeMode,
  };
}
