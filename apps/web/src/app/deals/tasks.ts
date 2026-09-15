import { apiFetch } from "../lib/api";

/** Ordered most urgent first; that order is what sorts a card's task list. */
export const TASK_PRIORITIES = ["high", "medium", "normal"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/**
 * How each priority reads and paints, in one place so the colour on a card and
 * the colour in the dialog can never drift apart.
 */
export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; dot: string; ring: string; fill: string }
> = {
  high: { label: "High", dot: "bg-rose-500", ring: "border-rose-500", fill: "bg-rose-500" },
  medium: { label: "Medium", dot: "bg-amber-500", ring: "border-amber-500", fill: "bg-amber-500" },
  normal: { label: "Normal", dot: "bg-sky-500", ring: "border-sky-500", fill: "bg-sky-500" },
};

/** Mirrors dealtasks.Task (services/internal/dealtasks/store.go). */
export interface DealTask {
  id: string;
  dealId: string;
  text: string;
  priority: TaskPriority;
  position: number;
  /** The three people, denormalized by the server so a card needs no lookup. */
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string | null;
  createdByName: string | null;
  completedBy: string | null;
  completedByName: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealTaskInput {
  dealId?: string;
  text: string;
  priority: TaskPriority;
  assignedTo?: string | null;
  done?: boolean;
}

const BASE = "/api/v1/deal-tasks";

export const dealTasksApi = {
  /** Omit dealId for every deal's tasks — how the board loads the whole set. */
  list: (dealId?: string) =>
    apiFetch<DealTask[]>(dealId ? `${BASE}?dealId=${encodeURIComponent(dealId)}` : BASE),

  create: (input: DealTaskInput) =>
    apiFetch<DealTask>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: DealTaskInput) =>
    apiFetch<DealTask>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(input) }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};

/**
 * Most urgent first, with each priority band keeping its stored order — a
 * stable sort, so ticking one task never reshuffles the rest.
 */
export function byPriority(tasks: DealTask[]): DealTask[] {
  return [...tasks].sort(
    (a, b) => TASK_PRIORITIES.indexOf(a.priority) - TASK_PRIORITIES.indexOf(b.priority),
  );
}

/** "Completed by Nikhil" / "Added by Karan" — the audit line under a task. */
export function auditLine(task: DealTask): string | null {
  if (task.done && task.completedByName) return `Done by ${task.completedByName}`;
  if (task.createdByName) return `Added by ${task.createdByName}`;
  return null;
}
