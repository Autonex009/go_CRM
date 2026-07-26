/**
 * Shared design tokens consumed by web (Tailwind) and mobile (RN StyleSheet).
 * Keep these framework-agnostic — plain values only.
 *
 * Full ramps, not three stops: a UI needs distinct values for borders, dividers,
 * muted text and hover fills. Without them every component reaches for opacity
 * hacks like `border-neutral-900/15`, which stack unpredictably and cost a
 * compositing layer.
 */
export const colors = {
  brand: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
  },
  neutral: {
    0: "#ffffff",
    50: "#fafafa",
    100: "#f4f4f5",
    200: "#e7e7ea",
    300: "#d4d4d8",
    400: "#a1a1aa",
    500: "#737373",
    600: "#52525b",
    700: "#3f3f46",
    800: "#27272a",
    900: "#171717",
  },
  // Status ramps, deliberately small: a chip fill, a solid, and a text tone.
  success: { 50: "#ecfdf5", 500: "#10b981", 600: "#059669", 700: "#047857" },
  warning: { 50: "#fffbeb", 500: "#f59e0b", 600: "#d97706", 700: "#b45309" },
  danger: { 50: "#fef2f2", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c" },
  info: { 50: "#eff6ff", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8" },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/**
 * Elevation. Two soft shadows only — a modern flat UI leans on borders and
 * spacing, and every extra blurred shadow is another thing for the compositor
 * to paint on scroll.
 */
export const shadow = {
  sm: "0 1px 2px 0 rgb(24 24 27 / 0.05)",
  md: "0 4px 12px -2px rgb(24 24 27 / 0.08), 0 2px 4px -2px rgb(24 24 27 / 0.04)",
  lg: "0 12px 32px -8px rgb(24 24 27 / 0.16), 0 4px 8px -4px rgb(24 24 27 / 0.06)",
} as const;

/** Shell measurements shared by the sidebar and the content offset. */
export const layout = {
  sidebarWidth: 232,
  sidebarCollapsedWidth: 64,
  topbarHeight: 56,
  contentMaxWidth: 1280,
} as const;

/**
 * System font stack. No webfont: a downloaded font costs a round-trip and a
 * flash of unstyled text on every cold load, which is a poor trade for a tool
 * people keep open all day.
 */
export const fontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
