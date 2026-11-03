import React from "react";
import { useTheme } from "./useTheme.js";

export default function ThemeToggle({ className = "ledger-btn ledger-btn-ghost", style }) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      className={className}
      style={{
        textTransform: "none",
        letterSpacing: "normal",
        fontWeight: 500,
        padding: "9px 14px",
        ...style,
      }}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
