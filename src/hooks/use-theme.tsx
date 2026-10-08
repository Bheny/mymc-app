"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "mymc-theme";

/**
 * Inline script for <head>: applies the saved (or system) theme before first
 * paint, so dark pages don't flash white. Keep in sync with THEME_STORAGE_KEY.
 */
export const themeInitScript = `(function(){try{
var t=localStorage.getItem("${THEME_STORAGE_KEY}");
if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
if(t==="dark")document.documentElement.classList.add("dark");
}catch(e){}})();`;

type ThemeContextValue = {
  theme:    Theme;
  setTheme: (t: Theme) => void;
  toggle:   () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (t === "light" || t === "dark") return t;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Server and first client render agree on "light"; the saved theme is read right after
  // mount. The page itself is already themed by the head script, so only the toggle icon updates.
  const [theme,  setThemeState] = useState<Theme>("light");
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => { setThemeState(readStoredTheme()); setLoaded(true); }, []);

  // Only touch the class once the saved theme is known — otherwise the first
  // run (theme still "light") would strip the head script's `dark` and flash
  useEffect(() => {
    if (loaded) document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme, loaded]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch { /* private mode */ }
  }, []);
  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  return createElement(ThemeContext.Provider, { value: { theme, setTheme, toggle } }, children);
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
