import type { Config } from "tailwindcss";
import { colors, radius, spacing } from "./index";

/**
 * Tailwind preset shared by the web app.
 * Import in apps/web/tailwind.config.ts via `presets: [preset]`.
 */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        neutral: colors.neutral,
      },
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([k, v]) => [k, `${v}px`]),
      ),
      spacing: Object.fromEntries(
        Object.entries(spacing).map(([k, v]) => [k, `${v}px`]),
      ),
    },
  },
};

export default preset;
