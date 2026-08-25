import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createTheme, type Theme } from "@mui/material/styles";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "webmirror.themeMode";

export function buildTheme(mode: ThemeMode): Theme {
  const isDark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: { main: "#10a37f" },
      secondary: { main: "#d97757" },
      background: {
        default: isDark ? "#1a1a1f" : "#f7f7f8",
        paper: isDark ? "#25252a" : "#ffffff",
      },
      text: {
        primary: isDark ? "#e5e5e7" : "#1a1a1a",
        secondary: isDark ? "#a1a1a6" : "#6e6e80",
      },
      divider: isDark ? "#3a3a40" : "#e0e0e0",
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 600 },
        },
      },
    },
  });
}

interface ThemeModeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: "light",
  toggleMode: () => {},
  setMode: () => {},
});

export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}

function getInitialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    // 同步 <html> 属性，给非 MUI 的原生 CSS 做钩子（滚动条、选区等）
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      toggleMode: () => setMode((prev) => (prev === "light" ? "dark" : "light")),
      setMode,
    }),
    [mode],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}
