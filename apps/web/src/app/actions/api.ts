import { apiFetch } from "../lib/api";

/** Mirrors followups.Statuses (services/internal/followups/service.go). */
export const ACTION_STATUSES = ["open", "in_progress", "done"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

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
  assignedTo?: string;
  accountId?: string;
}

export interface ActionUpdateInput {
  title: string;
  dueAt: string;
  status: ActionStatus;
  assignedTo?: string;
  accountId?: string;
}

export interface ActionFilter {
  accountId?: string;
  status?: ActionStatus;
  /** ISO 8601. Both ends are inclusive on the server. */
  dueBefore?: string;
  dueAfter?: string;
}

const BASE = "/api/v1/actions";

function query(filter: ActionFilter): string {
  const params = new URLSearchParams();
  if (filter.accountId) params.set("accountId", filter.accountId);
  if (filter.status) params.set("status", filter.status);
  if (filter.dueBefore) params.set("dueBefore", filter.dueBefore);
  if (filter.dueAfter) params.set("dueAfter", filter.dueAfter);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const actionsApi = {
  list: (filter: ActionFilter = {}) => apiFetch<Action[]>(`${BASE}${query(filter)}`),

  get: (id: string) => apiFetch<Action>(`${BASE}/${id}`),

  create: (input: ActionInput) =>
    apiFetch<Action>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: ActionUpdateInput) =>
    apiFetch<Action>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),

  complete: (id: string) => apiFetch<Action>(`${BASE}/${id}/complete`, { method: "POST" }),
};

/** "3 days overdue" / "Due tomorrow" — same wording convention as leads. */
export function dueLabel(action: Pick<Action, "dueAt" | "status">): { text: string; tone: "overdue" | "due" | "plain" } {
  const due = new Date(action.dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const finished = action.status === "done";

  if (days < 0) {
    const n = Math.abs(days);
    return { text: `${n} day${n === 1 ? "" : "s"} overdue`, tone: finished ? "plain" : "overdue" };
  }
  if (days === 0) return { text: "Due today", tone: finished ? "plain" : "due" };
  if (days === 1) return { text: "Due tomorrow", tone: "plain" };
  return {
    text: due.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    tone: "plain",
  };
}

export function isOverdue(action: Pick<Action, "dueAt" | "status">): boolean {
  return action.status !== "done" && new Date(action.dueAt).getTime() < Date.now();
}
