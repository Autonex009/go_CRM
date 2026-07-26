import type { Config } from "tailwindcss";
import { colors, fontStack, layout, radius, shadow, spacing } from "./index";

const px = (values: Record<string, number>) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, `${v}px`]));

/**
 * Tailwind preset shared by the web app.
 * Import in apps/web/tailwind.config.ts via `presets: [preset]`.
 *
 * Everything here is compile-time: Tailwind emits only the classes actually used,
 * so a richer token set costs nothing at runtime.
 */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
        info: colors.info,
      },
      borderRadius: px(radius),
      spacing: { ...px(spacing), ...px(layout) },
      boxShadow: shadow,
      fontFamily: { sans: [fontStack] },
      // Motion is short and transform/opacity-only, so it stays on the
      // compositor and never triggers layout.
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "translateY(4px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 120ms ease-out",
        "scale-in": "scale-in 140ms cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.4s infinite",
      },
    },
  },
};

export default preset;
