import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { accountsApi } from "../accounts/api";
import { AccountSelect } from "../accounts/AccountSelect";
import { ActionDialog } from "../actions/ActionDialog";
import { ActionsTable } from "../actions/ActionsTable";
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  actionsApi,
  isDueToday,
  isOverdue,
  type Action,
  type ActionFilter,
} from "../actions/api";
import { beforeToday, dayRange, weekRange } from "../actions/dates";
import { useActionMutations } from "../actions/useActionMutations";
import { leadsApi } from "../leads/api";
import { ApiError } from "../lib/api";
import { memberLabel, orgApi } from "../org/api";
import { Alert, Button, Card, EmptyState, PageHeader, SelectField, Skeleton } from "../ui";

/**
 * The saved views behind the KPI cards and the due-date pills. Each one is a
 * filter patch rather than a separate code path, which is what keeps a card's
 * number and the list it opens describing the same set of actions.
 */
type View = "all" | "overdue" | "today" | "week" | "active" | "done" | "custom";

type DueBounds = Pick<ActionFilter, "dueAfter" | "dueBefore" | "status" | "excludeDone">;

function viewBounds(view: View): DueBounds {
  switch (view) {
    case "overdue":
      return { dueAfter: undefined, dueBefore: beforeToday(), excludeDone: true, status: undefined };
    case "today": {
      const { start, end } = dayRange();
      return { dueAfter: start, dueBefore: end, excludeDone: true, status: undefined };
    }
    case "week": {
      const { start, end } = weekRange();
      return { dueAfter: start, dueBefore: end, excludeDone: undefined, status: undefined };
    }
    case "active":
      return { dueAfter: undefined, dueBefore: undefined, excludeDone: true, status: undefined };
    case "done":
      return { dueAfter: undefined, dueBefore: undefined, excludeDone: undefined, status: "done" };
    case "custom":
      return {};
    default:
      return { dueAfter: undefined, dueBefore: undefined, excludeDone: undefined, status: undefined };
  }
}

export default function Actions() {
  const [filter, setFilter] = useState<ActionFilter>({});
  const [view, setView] = useState<View>("all");
  const [dialog, setDialog] = useState<{ action: Action | null } | null>(null);

  const { save, remove, complete, error, setError } = useActionMutations();

  const query = useQuery({
    queryKey: ["actions", filter],
    queryFn: () => actionsApi.list(filter),
  });

  // The metrics roll-up is the unfiltered list, and shares its query key — so on
  // the default view React Query serves both from a single request.
  const metricsQuery = useQuery({
    queryKey: ["actions", {} as ActionFilter],
    queryFn: () => actionsApi.list({}),
    staleTime: 60_000,
  });

  // Both already cached elsewhere in the app (AccountSelect, DealDialog) —
  // reusing the query keys means this page adds no extra requests on repeat visits.
  const accounts = useQuery({
    queryKey: ["accountOptions"],
    queryFn: () => accountsApi.list(0, 500),
    staleTime: 5 * 60_000,
  });

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });

  const accountName = useMemo(() => {
    const map = new Map((accounts.data?.items ?? []).map((a) => [a.id, a.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "—");
  }, [accounts.data]);

  const memberName = useMemo(() => {
    const map = new Map((members.data ?? []).map((m) => [m.id, memberLabel(m)]));
    return (id: string | null) => (id ? (map.get(id) ?? "—") : "Unassigned");
  }, [members.data]);

  const leadsQuery = useQuery({
    queryKey: ["allLeadsForActions"],
    queryFn: () => leadsApi.list(0, "", 200),
    staleTime: 60_000,
  });

  const leadName = useMemo(() => {
    const map = new Map(
      (leadsQuery.data?.items ?? []).map((l) => [l.id, `${l.firstName} ${l.lastName || ""}`.trim()]),
    );
    return (id: string | null) => (id ? map.get(id) : undefined);
  }, [leadsQuery.data]);

  // Each count is the size of the list its card opens, so clicking a card never
  // shows a different number than the card did.
  const metrics = useMemo(() => {
    const all = metricsQuery.data ?? [];
    return {
      total: all.length,
      overdue: all.filter(isOverdue).length,
      dueToday: all.filter(isDueToday).length,
      active: all.filter((a) => a.status !== "done").length,
      done: all.filter((a) => a.status === "done").length,
    };
  }, [metricsQuery.data]);

  // Views only ever replace the date/status part of the filter — the client and
  // assignee a manager picked stay put while they scan across due dates.
  const applyView = (next: View) => {
    setView(next);
    setFilter((f) => ({ ...f, ...viewBounds(next) }));
  };

  const hasFilters =
    !!filter.accountId || !!filter.assignedTo || !!filter.status || !!filter.dueAfter ||
    !!filter.dueBefore || !!filter.excludeDone;

  const resetFilters = () => {
    setFilter({});
    setView("all");
    setError(null);
  };

  const items = query.data ?? [];

  const deleteAction = (id: string) => {
    if (!window.confirm("Delete this action?")) return;
    remove.mutate(id);
    setDialog(null);
  };

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Actions"
        subtitle="Plan and track what needs doing across clients and deals."
        action={<Button icon="plus" onClick={() => setDialog({ action: null })}>New action</Button>}
      />

      <div className="grid grid-cols-2 gap-md sm:grid-cols-5">
        <MetricCard
          label="Total actions"
          value={metrics.total}
          active={view === "all" && !hasFilters}
          onClick={resetFilters}
        />
        <MetricCard
          label="Overdue"
          value={metrics.overdue}
          tone="bad"
          active={view === "overdue"}
          onClick={() => applyView("overdue")}
        />
        <MetricCard
          label="Due today"
          value={metrics.dueToday}
          tone="warn"
          active={view === "today"}
          onClick={() => applyView("today")}
        />
        <MetricCard
          label="Active"
          value={metrics.active}
          active={view === "active"}
          onClick={() => applyView("active")}
        />
        <MetricCard
          label="Completed"
          value={metrics.done}
          tone="good"
          active={view === "done"}
          onClick={() => applyView("done")}
        />
      </div>

      <Card className="flex flex-col gap-md">
        <div className="flex flex-wrap items-end gap-md">
          <div className="flex min-w-48 flex-1 flex-col gap-xs">
            <AccountSelect
              label="Client"
              value={filter.accountId ?? ""}
              onChange={(e) => setFilter((f) => ({ ...f, accountId: e.target.value || undefined }))}
            />
          </div>

          <div className="flex min-w-44 flex-1 flex-col gap-xs">
            <SelectField
              label="Assignee"
              value={filter.assignedTo ?? ""}
              onChange={(e) => setFilter((f) => ({ ...f, assignedTo: e.target.value || undefined }))}
            >
              <option value="">All assignees</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {memberLabel(m)}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="flex flex-col gap-xs">
            <span className="text-xs font-medium text-fg-muted">Status</span>
            <div className="flex gap-1 rounded-xl border border-line bg-surface-muted/60 p-1">
              <FilterPill
                active={!filter.status}
                onClick={() => setFilter((f) => ({ ...f, status: undefined }))}
              >
                All
              </FilterPill>
              {ACTION_STATUSES.map((s) => (
                <FilterPill
                  key={s}
                  active={filter.status === s}
                  onClick={() => setFilter((f) => ({ ...f, status: s, excludeDone: undefined }))}
                >
                  {ACTION_STATUS_LABEL[s]}
                </FilterPill>
              ))}
            </div>
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="mb-1 self-end">
              Clear filters
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-md border-t border-line/60 pt-sm">
          <span className="text-xs font-medium text-fg-muted">Due date</span>
          <div className="flex flex-wrap items-center gap-1">
            <FilterPill active={view === "all"} onClick={() => applyView("all")}>
              All time
            </FilterPill>
            <FilterPill active={view === "overdue"} onClick={() => applyView("overdue")}>
              Overdue
            </FilterPill>
            <FilterPill active={view === "today"} onClick={() => applyView("today")}>
              Today
            </FilterPill>
            <FilterPill active={view === "week"} onClick={() => applyView("week")}>
              This week
            </FilterPill>
            <FilterPill active={view === "custom"} onClick={() => setView("custom")}>
              Custom range
            </FilterPill>
          </div>

          {view === "custom" && (
            <div className="flex flex-wrap items-center gap-sm">
              <DateInput
                label="From"
                value={filter.dueAfter?.slice(0, 10) ?? ""}
                onChange={(day) =>
                  setFilter((f) => ({ ...f, dueAfter: day ? `${day}T00:00:00Z` : undefined }))
                }
              />
              <DateInput
                label="To"
                value={filter.dueBefore?.slice(0, 10) ?? ""}
                onChange={(day) =>
                  setFilter((f) => ({ ...f, dueBefore: day ? `${day}T23:59:59Z` : undefined }))
                }
              />
            </div>
          )}
        </div>
      </Card>

      {error && <Alert>{error}</Alert>}
      {query.isError && (
        <Alert>{query.error instanceof ApiError ? query.error.message : "Could not load actions"}</Alert>
      )}

      {query.isPending ? (
        <Card padded={false} className="p-md">
          <div className="flex flex-col gap-sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[48px] w-full" />
            ))}
          </div>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon="check"
          title="Nothing here"
          description={
            hasFilters
              ? "No actions match this filter right now."
              : "Nothing is planned yet — add the first action."
          }
          action={
            hasFilters ? (
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : (
              <Button icon="plus" size="sm" onClick={() => setDialog({ action: null })}>
                New action
              </Button>
            )
          }
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ActionsTable
            actions={items}
            clientName={accountName}
            assigneeName={memberName}
            leadName={leadName}
            onOpen={(action) => setDialog({ action })}
            onComplete={(id) => complete.mutate(id)}
            busy={complete.isPending}
          />
        </Card>
      )}

      {dialog && (
        <ActionDialog
          action={dialog.action}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.action?.id, input })}
          onDelete={dialog.action ? () => deleteAction(dialog.action!.id) : undefined}
        />
      )}
    </section>
  );
}

const METRIC_TONE = {
  neutral: { label: "text-fg-muted", value: "text-fg", ring: "border-accent ring-accent" },
  bad: { label: "text-bad-fg", value: "text-bad-fg", ring: "border-bad ring-bad" },
  warn: { label: "text-warn-fg", value: "text-warn-fg", ring: "border-warn ring-warn" },
  good: { label: "text-good-fg", value: "text-good-fg", ring: "border-good ring-good" },
} as const;

function MetricCard({
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
        active ? `${t.ring} bg-surface-hover ring-1` : "border-line bg-surface hover:border-accent"
      }`}
    >
      <span className={`text-[11px] font-bold uppercase tracking-wider ${t.label}`}>{label}</span>
      <span className={`text-2xl font-bold tracking-tight ${t.value}`}>{value}</span>
    </button>
  );
}

function DateInput({
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

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
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
