import { memo } from "react";
import type { ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds the standard padding. Off for tables and lists that pad their own rows. */
  padded?: boolean;
  as?: "div" | "section" | "article";
}

/** The one panel style in the app. Border + tiny shadow, never a heavy drop. */
export function Card({ children, className = "", padded = true, as: Tag = "div" }: CardProps) {
  return (
    <Tag
      className={`rounded-lg border border-line bg-surface shadow-sm ${
        padded ? "p-lg" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Section heading inside a Card, with an optional right-hand action. */
export function CardHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-md ${className}`}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {subtitle && <p className="mt-[2px] text-xs text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page header                                                                */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-md">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-fg">{title}</h1>
        {subtitle && <p className="mt-xs text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

/**
 * Tone → semantic pair. Each tone has a soft fill and a readable foreground in
 * both themes, which is the whole reason these are variables: a light-mode chip
 * fill (#ecfdf5) is unreadable on a dark surface, so the variable flips instead
 * of the class.
 */
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-fg-muted",
  brand: "bg-accent-soft text-accent-on",
  success: "bg-ok-soft text-ok-fg",
  warning: "bg-warn-soft text-warn-fg",
  danger: "bg-bad-soft text-bad-fg",
  info: "bg-infoTone-soft text-infoTone-fg",
};

/** Solid dots stay on the fixed ramps — a 500 reads on both canvases. */
const DOTS: Record<Tone, string> = {
  neutral: "bg-neutral-400",
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  info: "bg-info-500",
};

export const Badge = memo(function Badge({
  children,
  tone = "neutral",
  dot = false,
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-xs rounded-full px-sm py-[2px] text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {dot && <span className={`h-[6px] w-[6px] rounded-full ${DOTS[tone]}`} />}
      {children}
    </span>
  );
});

/** Just the coloured dot, for column headers and legends. */
export const Dot = memo(function Dot({ tone, className = "" }: { tone: Tone; className?: string }) {
  return <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${DOTS[tone]} ${className}`} />;
});

export type { Tone };

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

/** Initials from a name or email. Shared by cards, the team list and the topbar. */
export function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Deterministic tint per person, so the same user is always the same colour
 * without storing one. Cheap string hash over the tone palette, which means the
 * tints follow the theme too.
 */
const AVATAR_TINTS = [
  "bg-accent-soft text-accent-on",
  "bg-infoTone-soft text-infoTone-fg",
  "bg-ok-soft text-ok-fg",
  "bg-warn-soft text-warn-fg",
  "bg-bad-soft text-bad-fg",
];

function tintFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

const AVATAR_SIZES = {
  xs: "h-[22px] w-[22px] text-[10px]",
  sm: "h-[28px] w-[28px] text-[11px]",
  md: "h-[36px] w-[36px] text-xs",
};

export const Avatar = memo(function Avatar({
  name,
  title,
  size = "sm",
}: {
  name: string;
  title?: string;
  size?: keyof typeof AVATAR_SIZES;
}) {
  return (
    <span
      title={title ?? name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${AVATAR_SIZES[size]} ${tintFor(name)}`}
    >
      {initials(name)}
    </span>
  );
});

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export function Alert({ children, tone = "danger" }: { children: ReactNode; tone?: Tone }) {
  const styles =
    tone === "danger" ? "bg-bad-soft text-bad-fg" : "bg-accent-soft text-accent-on";
  return (
    <p role="alert" className={`rounded-md px-md py-sm text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  hints,
  size = "md",
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  /**
   * What will show up here once there is something to show. An empty page that
   * explains what belongs on it reads as designed; one that just says "no data"
   * reads as unfinished.
   */
  hints?: string[];
  /** `sm` for an empty state sitting inside a card, `md` for a whole page. */
  size?: "sm" | "md";
}) {
  const large = size === "md";

  return (
    <div
      className={`flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface-muted/40 text-center ${
        large ? "px-lg py-2xl" : "px-md py-lg"
      }`}
    >
      {icon && (
        <span
          className={`flex items-center justify-center rounded-full border border-line bg-surface text-fg-subtle ${
            large ? "mb-md h-[44px] w-[44px]" : "mb-sm h-[32px] w-[32px]"
          }`}
        >
          <Icon name={icon} size={large ? 20 : 16} />
        </span>
      )}

      <p className={`font-semibold text-fg ${large ? "text-base" : "text-sm"}`}>{title}</p>
      {description && (
        <p className={`mt-xs text-fg-muted ${large ? "max-w-[46ch] text-sm" : "max-w-[38ch] text-xs"}`}>
          {description}
        </p>
      )}

      {hints && hints.length > 0 && (
        <ul className="mt-md flex flex-wrap justify-center gap-xs">
          {hints.map((hint) => (
            <li
              key={hint}
              className="rounded-full border border-line bg-surface px-md py-xs text-xs text-fg-muted"
            >
              {hint}
            </li>
          ))}
        </ul>
      )}

      {action && <div className="mt-lg">{action}</div>}
    </div>
  );
}

/**
 * Loading placeholder. A shimmering block beats the word "Loading…" because the
 * layout doesn't jump when data lands — the skeleton occupies the real height.
 * The sweep is a transform, so it animates on the compositor.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden rounded-md bg-surface-muted ${className}`}
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-surface-hover to-transparent" />
    </span>
  );
}

/**
 * Indeterminate progress, for the two cases a Skeleton can't cover: the height
 * isn't known yet (app boot), or the content is already on screen and merely
 * refreshing, where swapping it for grey blocks would be a downgrade.
 *
 * A rotating ring with one coloured edge — a single element and one transform,
 * animated on the compositor, rather than an SVG of dashes redrawn each frame.
 */
export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size, borderWidth: size <= 16 ? 2 : 3 }}
      className={`inline-block shrink-0 animate-spin rounded-full border-line border-t-accent ${className}`}
    />
  );
}

export function Divider({ children }: { children?: ReactNode }) {
  if (!children) return <hr className="border-line" />;
  return (
    <div className="flex items-center gap-md text-xs uppercase tracking-wide text-fg-subtle">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
