import type { KanbanColumnDef, Tone } from "../ui";
import { type Ask, type AskPriority, type AskStatus } from "./api";

interface StatusMeta {
  label: string;
  tone: Tone;
  bar: string;
  /** The coloured dot the board header draws beside a column name. */
  dot: string;
}

export const STATUS_META: Record<AskStatus, StatusMeta> = {
  requested: { label: "Requested", tone: "neutral", bar: "bg-slate-400", dot: "bg-slate-400" },
  acknowledged: { label: "Acknowledged", tone: "info", bar: "bg-indigo-400", dot: "bg-indigo-400" },
  in_progress: { label: "In progress", tone: "brand", bar: "bg-violet-500", dot: "bg-violet-500" },
  blocked: { label: "Blocked", tone: "danger", bar: "bg-rose-500", dot: "bg-rose-500" },
  delivered: { label: "Delivered", tone: "success", bar: "bg-emerald-500", dot: "bg-emerald-500" },
  verified: { label: "Verified", tone: "success", bar: "bg-teal-500", dot: "bg-teal-500" },
  wont_do: { label: "Won't do", tone: "neutral", bar: "bg-zinc-400", dot: "bg-zinc-400" },
};

/**
 * The five columns the board draws.
 *
 * Verified and Won't do are real statuses but not columns: the board shows
 * every *open* ask, and those two are the endings. An ask is moved into them
 * from its own dialog, which is also where it can be brought back.
 */
export const BOARD_STATUSES: readonly AskStatus[] = [
  "requested",
  "acknowledged",
  "in_progress",
  "blocked",
  "delivered",
];

export const IMPLEMENTATION_COLUMNS: readonly KanbanColumnDef[] = BOARD_STATUSES.map(
  (status) => ({
    key: status,
    label: STATUS_META[status].label,
    tone: STATUS_META[status].tone,
    bar: STATUS_META[status].bar,
  }),
);

/** Deterministic colour per company, so one client reads the same everywhere. */
const COMPANY_TINTS = [
  "text-amber-500",
  "text-sky-400",
  "text-emerald-400",
  "text-violet-400",
  "text-rose-400",
  "text-teal-400",
];

export function companyTint(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return COMPANY_TINTS[Math.abs(hash) % COMPANY_TINTS.length];
}

interface PriorityMeta {
  label: string;
  /** Chip styling. P0 is the only one that shouts. */
  chip: string;
}

export const PRIORITY_META: Record<AskPriority, PriorityMeta> = {
  p0: { label: "P0", chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  p1: { label: "P1", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  p2: { label: "P2", chip: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
};

/** Terminal states: still columns, but not outstanding work. */
export function isClosed(status: AskStatus): boolean {
  return status === "verified" || status === "wont_do";
}

export function isOverdue(ask: Ask): boolean {
  if (!ask.dueAt || isClosed(ask.status)) return false;
  return new Date(ask.dueAt).getTime() < Date.now();
}

/** "28 Sep", or "overdue" when it has slipped, or "—" when unset. */
export function dueLabel(ask: Ask): { text: string; overdue: boolean } {
  if (isClosed(ask.status)) return { text: "done", overdue: false };
  if (!ask.dueAt) return { text: "—", overdue: false };
  if (isOverdue(ask)) return { text: "overdue", overdue: true };
  return {
    text: new Date(ask.dueAt).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    }),
    overdue: false,
  };
}

/** The company or lead this ask belongs to — what a board card leads with. */
export function parentName(ask: Ask): string {
  return ask.accountName || ask.dealTitle || ask.leadTitle || "Unlinked";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Renders one history line as a sentence. */
export function describeEvent(e: {
  kind: string;
  field: string;
  fromValue: string;
  toValue: string;
  note: string;
}): string {
  switch (e.kind) {
    case "created":
      return "raised this ask";
    case "status_changed":
      return e.fromValue
        ? `moved it from ${e.fromValue} to ${e.toValue}`
        : `moved it to ${e.toValue}`;
    case "assigned":
      return e.toValue ? `assigned it to ${e.toValue}` : "unassigned it";
    case "priority_changed":
      return `changed priority to ${e.toValue.toUpperCase()}`;
    case "due_changed":
      return e.toValue
        ? `set the due date to ${new Date(e.toValue).toLocaleDateString()}`
        : "cleared the due date";
    case "blocked":
      return `noted the blocker: ${e.toValue}`;
    case "attached":
      return `attached ${e.toValue}`;
    case "detached":
      return `removed ${e.toValue}`;
    case "edited":
      return `edited the ${e.field}`;
    default:
      return e.kind;
  }
}
