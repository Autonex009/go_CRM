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
      className={`rounded-lg border border-neutral-200 bg-white shadow-sm ${
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
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {subtitle && <p className="mt-[2px] text-xs text-neutral-500">{subtitle}</p>}
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
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-neutral-900">{title}</h1>
        {subtitle && <p className="mt-xs text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                      */
/* -------------------------------------------------------------------------- */

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-600",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-info-50 text-info-700",
};

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
 * without storing one. Cheap string hash over a fixed palette.
 */
const AVATAR_TINTS = [
  "bg-brand-100 text-brand-700",
  "bg-info-50 text-info-700",
  "bg-success-50 text-success-700",
  "bg-warning-50 text-warning-700",
  "bg-danger-50 text-danger-700",
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

/** Inline error banner. Replaces the old auth-only Alert. */
export function Alert({ children, tone = "danger" }: { children: ReactNode; tone?: Tone }) {
  const styles =
    tone === "danger"
      ? "border-danger-500/30 bg-danger-50 text-danger-700"
      : "border-brand-500/30 bg-brand-50 text-brand-700";
  return (
    <p role="alert" className={`rounded-md border px-md py-sm text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 px-lg py-xl text-center">
      {icon && (
        <span className="mb-md flex h-[36px] w-[36px] items-center justify-center rounded-full bg-white text-neutral-400 shadow-sm">
          <Icon name={icon} size={18} />
        </span>
      )}
      <p className="text-sm font-medium text-neutral-900">{title}</p>
      {description && <p className="mt-xs max-w-[36ch] text-xs text-neutral-500">{description}</p>}
      {action && <div className="mt-md">{action}</div>}
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
      className={`relative block overflow-hidden rounded-md bg-neutral-100 ${className}`}
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </span>
  );
}

export function Divider({ children }: { children?: ReactNode }) {
  if (!children) return <hr className="border-neutral-200" />;
  return (
    <div className="flex items-center gap-md text-xs uppercase tracking-wide text-neutral-400">
      <span className="h-px flex-1 bg-neutral-200" />
      {children}
      <span className="h-px flex-1 bg-neutral-200" />
    </div>
  );
}
