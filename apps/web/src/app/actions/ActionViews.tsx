import type { ReactNode } from "react";

import { isDueToday, isOverdue, type Action, type ActionFilter } from "./api";
import { beforeToday, dayRange, weekRange } from "./dates";

/**
 * The saved views behind the KPI cards and the due-date pills, and the controls
 * that drive them.
 *
 * These live here rather than in the Actions page because the deal board opens
 * the same surface in a dialog. One copy means a card's number and the list it
 * opens cannot start describing different sets of actions.
 */
export type View =
  "all" | "overdue" | "today" | "week" | "active" | "done" | "custom";

type DueBounds = Pick<
  ActionFilter,
  "dueAfter" | "dueBefore" | "status" | "excludeDone"
>;

/** Each view is a filter patch rather than a separate code path. */
export function viewBounds(view: View): DueBounds {
  switch (view) {
    case "overdue":
      return {
        dueAfter: undefined,
        dueBefore: beforeToday(),
        excludeDone: true,
        status: undefined,
      };
    case "today": {
      const { start, end } = dayRange();
      return {
        dueAfter: start,
        dueBefore: end,
        excludeDone: true,
        status: undefined,
      };
    }
    case "week": {
      const { start, end } = weekRange();
      return {
        dueAfter: start,
        dueBefore: end,
        excludeDone: undefined,
        status: undefined,
      };
    }
    case "active":
      return {
        dueAfter: undefined,
        dueBefore: undefined,
        excludeDone: true,
        status: undefined,
      };
    case "done":
      return {
        dueAfter: undefined,
        dueBefore: undefined,
        excludeDone: undefined,
        status: "done",
      };
    case "custom":
      return {};
    default:
      return {
        dueAfter: undefined,
        dueBefore: undefined,
        excludeDone: undefined,
        status: undefined,
      };
  }
}

/** Each count is the size of the list its card opens. */
export function actionMetrics(all: Action[]) {
  return {
    total: all.length,
    overdue: all.filter(isOverdue).length,
    dueToday: all.filter(isDueToday).length,
    active: all.filter((a) => a.status !== "done").length,
    done: all.filter((a) => a.status === "done").length,
  };
}

/** True when anything narrows the list beyond the current view's date bounds. */
export function hasActiveFilters(filter: ActionFilter): boolean {
  return (
    !!filter.accountId ||
    !!filter.assignedTo ||
    !!filter.status ||
    !!filter.dueAfter ||
    !!filter.dueBefore ||
    !!filter.excludeDone
  );
}

const METRIC_TONE = {
  neutral: {
    label: "text-fg-muted",
    value: "text-fg",
    ring: "border-accent ring-accent",
  },
  bad: {
    label: "text-bad-fg",
    value: "text-bad-fg",
    ring: "border-bad ring-bad",
  },
  warn: {
    label: "text-warn-fg",
    value: "text-warn-fg",
    ring: "border-warn ring-warn",
  },
  good: {
    label: "text-good-fg",
    value: "text-good-fg",
    ring: "border-good ring-good",
  },
} as const;

export function MetricCard({
  label,
  value,
  tone = "neutral",
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: keyof typeof METRIC_TONE;
  active: boolean;
  onClick: () => void;
}) {
  const t = METRIC_TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col gap-xs rounded-xl border p-md text-left transition-all hover:shadow-xs ${
        active
          ? `${t.ring} bg-surface-hover ring-1`
          : "border-line bg-surface hover:border-accent"
      }`}
    >
      <span
        className={`text-[11px] font-bold uppercase tracking-wider ${t.label}`}
      >
        {label}
      </span>
      <span className={`text-2xl font-bold tracking-tight ${t.value}`}>
        {value}
      </span>
    </button>
  );
}

export function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (day: string) => void;
}) {
  return (
    <label className="flex items-center gap-xs text-xs text-fg-muted">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[32px] rounded-md border border-line bg-surface px-sm text-xs text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
      />
    </label>
  );
}

export function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition-all ${
        active
          ? "bg-accent font-semibold text-white shadow-xs"
          : "bg-surface-muted/80 text-fg-muted hover:bg-surface-hover hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
