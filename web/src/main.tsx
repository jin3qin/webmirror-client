import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { buildTheme, ThemeModeProvider, useThemeMode } from "./theme";

/** 动态主题：根据当前 mode 实时生成 MUI 主题 */
function ThemedRoot() {
  const { mode } = useThemeMode();
  const theme = useMemo(() => buildTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <ThemedRoot />
    </ThemeModeProvider>
  </React.StrictMode>,
);
