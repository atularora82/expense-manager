import { useCallback, useEffect, useState } from "react";
import { getEffectiveTheme, setTheme as persistTheme, subscribeTheme } from "./theme.js";

export function useTheme() {
  const [theme, setThemeState] = useState(() => getEffectiveTheme());

  useEffect(() => subscribeTheme(setThemeState), []);

  const setTheme = useCallback((next) => {
    persistTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    persistTheme(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return { theme, setTheme, toggleTheme };
}
