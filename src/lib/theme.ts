import type { Theme } from "../services/users";

function readStoredTheme(): Theme {
  return (window.localStorage.getItem("auditflow-theme") as Theme | null) ?? "light";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

/** Sets the resolved light/dark attribute the stylesheet's `html[data-theme="dark"]` overrides
 * key off of. Takes the raw preference (including "system") and resolves it. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = resolveTheme(theme);
}

/** Applies the stored theme preference immediately on app boot - without this, dark/system mode
 * only ever took effect while ProfilePage itself was mounted, so a fresh load or navigating
 * straight to any other page rendered light regardless of the saved preference. Also keeps
 * "system" live: if the OS theme flips while the tab is open, the app follows it. */
export function initTheme(): void {
  applyTheme(readStoredTheme());
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    applyTheme(readStoredTheme());
  });
}
