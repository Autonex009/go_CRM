import { apiFetch } from "../lib/api";
import { daysUntil } from "./dates";

/** Mirrors followups.Statuses (services/internal/followups/service.go). */
export const ACTION_STATUSES = ["open", "in_progress", "done"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

/**
 * An action's priority, and the colours it is drawn in.
 *
 * The same three levels and the same palette as a deal task
 * (`deals/tasks.ts`): the two lists sit beside each other in a deal's working
 * view, and one vocabulary across both is the point.
 */
export const ACTION_PRIORITIES = ["high", "medium", "normal"] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const ACTION_PRIORITY_META: Record<
  ActionPriority,
  { label: string; dot: string; ring: string; fill: string }
> = {
  high: {
    label: "High",
    dot: "bg-rose-500",
    ring: "border-rose-500",
    fill: "bg-rose-500",
  },
  medium: {
    label: "Medium",
    dot: "bg-amber-500",
    ring: "border-amber-500",
    fill: "bg-amber-500",
  },
  normal: {
    label: "Normal",
    dot: "bg-sky-500",
    ring: "border-sky-500",
    fill: "bg-sky-500",
  },
};

/**
 * An action's priority, as a level this client knows.
 *
 * A server that predates the column sends no priority at all, and every read
 * here would otherwise be an undefined lookup — which is what crashed the
 * deal's working view the first time it met a pre-migration API. Treating an
 * absent or unrecognised value as "normal" is the rule the server already
 * applies when a caller omits it.
 */
export function actionPriority(action: Action): ActionPriority {
  const p = action.priority as ActionPriority | undefined;
  return p && ACTION_PRIORITIES.includes(p) ? p : "normal";
}

/** Highest first, then by when it is due — what matters before what is next. */
export function byPriority(actions: Action[]): Action[] {
  const rank = (a: Action) => ACTION_PRIORITIES.indexOf(actionPriority(a));
  return [...actions].sort(
    (a, b) => rank(a) - rank(b) || a.dueAt.localeCompare(b.dueAt),
  );
}

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

/** Mirrors followups.Action — one row on the Actions dashboard. */
export interface Action {
  id: string;
  title: string;
  dueAt: string;
  status: ActionStatus;
  priority: ActionPriority;
  assignedTo: string | null;
  accountId: string | null;
  leadId: string | null;
  dealId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionInput {
  title: string;
  dueAt: string;
  /** Omitted means "normal" — the server fills it in. */
  priority?: ActionPriority;
  assignedTo?: string;
  accountId?: string;
  leadId?: string;
  dealId?: string;
}

export interface ActionUpdateInput {
  title: string;
  dueAt: string;
  status: ActionStatus;
  priority?: ActionPriority;
  assignedTo?: string;
  accountId?: string;
  leadId?: string;
  dealId?: string;
}

export interface ActionFilter {
  accountId?: string;
  leadId?: string;
  dealId?: string;
  assignedTo?: string;
  status?: ActionStatus;
  /** Drops completed actions. Independent of `status`, so "everything still
   *  outstanding" is one request rather than two. */
  excludeDone?: boolean;
  /** ISO 8601. Both ends are inclusive on the server. */
  dueBefore?: string;
  dueAfter?: string;
}

const BASE = "/api/v1/actions";

function query(filter: ActionFilter): string {
  const params = new URLSearchParams();
  if (filter.accountId) params.set("accountId", filter.accountId);
  if (filter.leadId) params.set("leadId", filter.leadId);
  if (filter.dealId) params.set("dealId", filter.dealId);
  if (filter.assignedTo) params.set("assignedTo", filter.assignedTo);
  if (filter.status) params.set("status", filter.status);
  if (filter.excludeDone) params.set("excludeDone", "true");
  if (filter.dueBefore) params.set("dueBefore", filter.dueBefore);
  if (filter.dueAfter) params.set("dueAfter", filter.dueAfter);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const actionsApi = {
  list: (filter: ActionFilter = {}) =>
    apiFetch<Action[]>(`${BASE}${query(filter)}`),

  get: (id: string) => apiFetch<Action>(`${BASE}/${id}`),

  create: (input: ActionInput) =>
    apiFetch<Action>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: ActionUpdateInput) =>
    apiFetch<Action>(`${BASE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),

  complete: (id: string) =>
    apiFetch<Action>(`${BASE}/${id}/complete`, { method: "POST" }),
};

/** "3 days overdue" / "Due tomorrow" — same wording convention as leads. */
export function dueLabel(action: Pick<Action, "dueAt" | "status">): {
  text: string;
  tone: "overdue" | "due" | "plain";
} {
  const days = daysUntil(action.dueAt);
  const finished = action.status === "done";

  if (days < 0) {
    const n = Math.abs(days);
    return {
      text: `${n} day${n === 1 ? "" : "s"} overdue`,
      tone: finished ? "plain" : "overdue",
    };
  }
  if (days === 0)
    return { text: "Due today", tone: finished ? "plain" : "due" };
  if (days === 1) return { text: "Due tomorrow", tone: "plain" };
  return {
    text: new Date(action.dueAt).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }),
    tone: "plain",
  };
}

/** Past its due day and not finished — the condition that reddens a row. */
export function isOverdue(action: Pick<Action, "dueAt" | "status">): boolean {
  return action.status !== "done" && daysUntil(action.dueAt) < 0;
}

/** Due on today's calendar day and not finished. */
export function isDueToday(action: Pick<Action, "dueAt" | "status">): boolean {
  return action.status !== "done" && daysUntil(action.dueAt) === 0;
}
