import { memo } from "react";

import { IconButton } from "./Button";
import type { IconName } from "./Icon";
import { useThemeStore, type Theme } from "./theme";

const ICONS: Record<Theme, IconName> = {
  system: "monitor",
  light: "sun",
  dark: "moon",
};

const LABELS: Record<Theme, string> = {
  system: "Theme: match system",
  light: "Theme: light",
  dark: "Theme: dark",
};

/**
 * One button that cycles system → light → dark.
 *
 * A single control rather than a dropdown: three states are cheap to cycle, and
 * the icon always states the current one, so the choice is legible without
 * opening anything.
 */
export const ThemeToggle = memo(function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const cycle = useThemeStore((s) => s.cycle);

  return <IconButton name={ICONS[theme]} label={LABELS[theme]} onClick={cycle} />;
});
