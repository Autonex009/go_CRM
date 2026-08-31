interface Config {
  darkMode?: string | string[];
  theme?: Record<string, any>;
}
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
/**
 * Semantic aliases backed by CSS custom properties (apps/web/src/styles/theme.css).
 *
 * Components style against these, never against a raw ramp, so a theme switch is
 * a variable swap rather than a second set of `dark:` classes on every element.
 * `<alpha-value>` keeps modifiers like `bg-surface/60` working.
 */
const semantic = {
  canvas: "rgb(var(--canvas) / <alpha-value>)",
  surface: {
    DEFAULT: "rgb(var(--surface) / <alpha-value>)",
    muted: "rgb(var(--surface-muted) / <alpha-value>)",
    hover: "rgb(var(--surface-hover) / <alpha-value>)",
  },
  line: {
    DEFAULT: "rgb(var(--line) / <alpha-value>)",
    strong: "rgb(var(--line-strong) / <alpha-value>)",
  },
  fg: {
    DEFAULT: "rgb(var(--fg) / <alpha-value>)",
    muted: "rgb(var(--fg-muted) / <alpha-value>)",
    subtle: "rgb(var(--fg-subtle) / <alpha-value>)",
  },
  accent: {
    DEFAULT: "rgb(var(--accent) / <alpha-value>)",
    hover: "rgb(var(--accent-hover) / <alpha-value>)",
    soft: "rgb(var(--accent-soft) / <alpha-value>)",
    on: "rgb(var(--accent-on) / <alpha-value>)",
  },
  ok: {
    soft: "rgb(var(--ok-soft) / <alpha-value>)",
    fg: "rgb(var(--ok-fg) / <alpha-value>)",
  },
  warn: {
    soft: "rgb(var(--warn-soft) / <alpha-value>)",
    fg: "rgb(var(--warn-fg) / <alpha-value>)",
  },
  bad: {
    soft: "rgb(var(--bad-soft) / <alpha-value>)",
    fg: "rgb(var(--bad-fg) / <alpha-value>)",
    solid: "rgb(var(--bad-solid) / <alpha-value>)",
  },
  infoTone: {
    soft: "rgb(var(--info-soft) / <alpha-value>)",
    fg: "rgb(var(--info-fg) / <alpha-value>)",
  },
  overlay: "rgb(var(--overlay) / <alpha-value>)",
} as const;

const preset: Partial<Config> = {
  // Class strategy, not media: the app offers an explicit light/dark/system
  // choice, which a media query alone can't express.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ...semantic,
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
