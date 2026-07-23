"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  THEMES,
  isColorMode,
  isThemeId,
  type ColorMode,
  type ThemeId,
} from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
  themes: typeof THEMES;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyAppearance(theme: ThemeId, mode: ColorMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.mode = mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [mode, setModeState] = useState<ColorMode>(DEFAULT_MODE);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY);
    const nextTheme = isThemeId(savedTheme) ? savedTheme : DEFAULT_THEME;
    const nextMode = isColorMode(savedMode) ? savedMode : DEFAULT_MODE;
    setThemeState(nextTheme);
    setModeState(nextMode);
    applyAppearance(nextTheme, nextMode);
  }, []);

  const setTheme = useCallback(
    (id: ThemeId) => {
      setThemeState(id);
      applyAppearance(id, mode);
      window.localStorage.setItem(THEME_STORAGE_KEY, id);
    },
    [mode],
  );

  const setMode = useCallback(
    (next: ColorMode) => {
      setModeState(next);
      applyAppearance(theme, next);
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    },
    [theme],
  );

  const toggleMode = useCallback(() => {
    setMode(mode === "light" ? "dark" : "light");
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ theme, setTheme, mode, setMode, toggleMode, themes: THEMES }),
    [theme, setTheme, mode, setMode, toggleMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
