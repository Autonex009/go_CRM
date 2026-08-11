import { apiFetch } from "../lib/api";
import type { IconName, Tone } from "../ui";

/** Kinds a person can log. "system" is written only by the server. */
export const ACTIVITY_KINDS = ["note", "call", "email", "meeting", "site_visit"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number] | "system";

/** Mirrors activities.Activity. */
export interface Activity {
  id: string;
  kind: ActivityKind;
  subject: string | null;
  body: string | null;
  /** When it happened — not always when it was typed in. */
  occurredAt: string;
  durationMinutes: number | null;

  leadId: string | null;
  dealId: string | null;
  accountId: string | null;
  contactId: string | null;
  quoteId: string | null;
  invoiceId: string | null;

  leadName: string | null;
  dealTitle: string | null;
  accountName: string | null;
  contactName: string | null;

  createdBy: string | null;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string;
}

/** Which record's timeline to read. Exactly one is normally set. */
export interface ActivityScope {
  leadId?: string;
  dealId?: string;
  accountId?: string;
  contactId?: string;
  quoteId?: string;
  invoiceId?: string;
}

export interface ActivityInput extends ActivityScope {
  kind: ActivityKind;
  subject?: string;
  body?: string;
  occurredAt?: string;
  durationMinutes?: number;
}

const BASE = "/api/v1/activities";

function scopeQuery(scope: ActivityScope, limit?: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(scope)) {
    if (value) params.set(key, value);
  }
  if (limit) params.set("limit", String(limit));
  const q = params.toString();
  return q ? `?${q}` : "";
}

export const activitiesApi = {
  list: (scope: ActivityScope = {}, limit?: number) =>
    apiFetch<Activity[]>(`${BASE}${scopeQuery(scope, limit)}`),

  create: (input: ActivityInput) =>
    apiFetch<Activity>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: Omit<ActivityInput, keyof ActivityScope>) =>
    apiFetch<Activity>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};

/**
 * A stable query key for one record's timeline, so logging an activity can
 * invalidate exactly the timeline it belongs to.
 */
export function activityKey(scope: ActivityScope): unknown[] {
  return ["activities", scope];
}

interface KindMeta {
  label: string;
  icon: IconName;
  tone: Tone;
}

export const KIND_META: Record<ActivityKind, KindMeta> = {
  note: { label: "Note", icon: "leads", tone: "neutral" },
  call: { label: "Call", icon: "phone", tone: "info" },
  email: { label: "Email", icon: "mail", tone: "brand" },
  meeting: { label: "Meeting", icon: "team", tone: "warning" },
  site_visit: { label: "Site visit", icon: "building", tone: "success" },
  // Written by the server on a state change; never selectable in the composer.
  system: { label: "System", icon: "check", tone: "neutral" },
};

/** "2 days ago" / "in 3 days" — the timestamp format the spec asks for. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60_000);

  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return mins > 0 ? `${mins}m ago` : `in ${-mins}m`;

  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return hours > 0 ? `${hours}h ago` : `in ${-hours}h`;

  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) {
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    return days > 0 ? `${days} days ago` : `in ${-days} days`;
  }
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Display name for whoever logged it; system events have no author. */
export function authorLabel(activity: Activity): string {
  if (activity.kind === "system") return "System";
  return activity.authorName?.trim() || activity.authorEmail || "Unknown";
}
