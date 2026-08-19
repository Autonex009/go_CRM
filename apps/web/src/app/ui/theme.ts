import { useEffect } from "react";
import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

/**
 * Stored as a bare string under this key — not a serialized zustand blob —
 * because the inline boot script in layouts/Base.astro has to read it before any
 * JS bundle loads. Keep the key and the three values in sync with that script.
 */
const STORAGE_KEY = "gocrm.theme";

function readStored(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function prefersDark(): boolean {
  return typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

/** Applies (or removes) the `dark` class the CSS variables hang off. */
function apply(theme: Theme): void {
  if (typeof document === "undefined") return;
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Cycles system → light → dark → system, for the single toggle button. */
  cycle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStored(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Storage disabled: the choice just won't survive a reload. */
    }
    apply(theme);
    set({ theme });
  },
  cycle: () => {
    const order: Theme[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(get().theme) + 1) % order.length];
    get().setTheme(next);
  },
}));

/**
 * Keeps the document in step with the OS while the user is on "system".
 *
 * Mounted once by AppRoot. The listener is only consulted in system mode, so an
 * explicit light/dark choice is never overridden by the OS changing.
 */
export function useSystemThemeSync(): void {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    apply(theme);
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
}
