/**
 * Shared design tokens consumed by web (Tailwind) and mobile (RN StyleSheet).
 * Keep these framework-agnostic — plain values only.
 */
export const colors = {
  brand: {
    50: "#eef2ff",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
  },
  neutral: {
    50: "#fafafa",
    500: "#737373",
    900: "#171717",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
} as const;
