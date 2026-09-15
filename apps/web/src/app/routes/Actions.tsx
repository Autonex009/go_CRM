import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { accountsApi } from "../accounts/api";
import { AccountSelect } from "../accounts/AccountSelect";
import { ActionDialog } from "../actions/ActionDialog";
import {
  ACTION_STATUSES,
  ACTION_STATUS_LABEL,
  actionsApi,
  dueLabel,
  isOverdue,
  type Action,
  type ActionFilter,
  type ActionStatus,
} from "../actions/api";
import { ApiError } from "../lib/api";
import { memberLabel, orgApi } from "../org/api";
import { Alert, Badge, Button, Card, EmptyState, Skeleton, PageHeader } from "../ui";

const STATUS_TONE: Record<ActionStatus, "neutral" | "info" | "success"> = {
  open: "neutral",
  in_progress: "info",
  done: "success",
};

export default function Actions() {
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<ActionFilter>({});
  const [dialog, setDialog] = useState<{ action: Action | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["actions", filter],
    queryFn: () => actionsApi.list(filter),
  });

  // Both already cached elsewhere in the app (AccountSelect, DealDialog) —
  // reusing the query keys means this page adds no extra requests on repeat visits.
  const accounts = useQuery({
    queryKey: ["accountOptions"],
    queryFn: () => accountsApi.list(0, 100),
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

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["actions"] });
  }, [queryClient]);

  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: Parameters<typeof actionsApi.update>[1] }) => {
      if (id) return actionsApi.update(id, input);
      // The gateway rejects unknown JSON fields, and a new action always
      // starts "open" server-side — status is only ever sent on an update.
      const { status: _status, ...createInput } = input;
      return actionsApi.create(createInput);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => actionsApi.remove(id),
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: (id: string) => actionsApi.complete(id),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not complete that action"),
  });

  const items = query.data ?? [];

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Actions"
        subtitle="Plan and track what needs doing, per client."
        action={<Button icon="plus" onClick={() => setDialog({ action: null })}>New action</Button>}
      />

      <Card className="flex flex-wrap items-end gap-md">
        <div className="flex min-w-48 flex-1 flex-col gap-xs">
          <AccountSelect
            label="Client"
            value={filter.accountId ?? ""}
            onChange={(e) => setFilter((f) => ({ ...f, accountId: e.target.value || undefined }))}
          />
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
                onClick={() => setFilter((f) => ({ ...f, status: s }))}
              >
                {ACTION_STATUS_LABEL[s]}
              </FilterPill>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-xs">
          <span className="text-xs font-medium text-fg-muted">Due after</span>
          <input
            type="date"
            value={filter.dueAfter?.slice(0, 10) ?? ""}
            onChange={(e) =>
              setFilter((f) => ({ ...f, dueAfter: e.target.value ? `${e.target.value}T00:00:00Z` : undefined }))
            }
            className="h-[36px] rounded-md border border-line bg-surface px-md text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-xs font-medium text-fg-muted">Due before</span>
          <input
            type="date"
            value={filter.dueBefore?.slice(0, 10) ?? ""}
            onChange={(e) =>
              setFilter((f) => ({ ...f, dueBefore: e.target.value ? `${e.target.value}T23:59:59Z` : undefined }))
            }
            className="h-[36px] rounded-md border border-line bg-surface px-md text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </label>
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
          description="No actions match this filter right now."
          action={
            <Button icon="plus" size="sm" onClick={() => setDialog({ action: null })}>
              New action
            </Button>
          }
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-lg py-sm font-medium">Action</th>
                  <th className="px-lg py-sm font-medium">Client</th>
                  <th className="px-lg py-sm font-medium">Assignee</th>
                  <th className="px-lg py-sm font-medium">Due</th>
                  <th className="px-lg py-sm font-medium">Status</th>
                  <th className="px-lg py-sm font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((action) => (
                  <Row
                    key={action.id}
                    action={action}
                    clientName={accountName(action.accountId)}
                    assigneeName={memberName(action.assignedTo)}
                    onOpen={() => setDialog({ action })}
                    onComplete={() => complete.mutate(action.id)}
                    busy={complete.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {dialog && (
        <ActionDialog
          action={dialog.action}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.action?.id, input })}
          onDelete={
            dialog.action
              ? () => {
                  if (window.confirm("Delete this action?")) {
                    remove.mutate(dialog.action!.id);
                    setDialog(null);
                  }
                }
              : undefined
          }
        />
      )}
    </section>
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
      className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
        active ? "bg-indigo-600 text-white shadow-xs" : "text-fg-muted hover:text-fg hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  action,
  clientName,
  assigneeName,
  onOpen,
  onComplete,
  busy,
}: {
  action: Action;
  clientName: string;
  assigneeName: string;
  onOpen: () => void;
  onComplete: () => void;
  busy: boolean;
}) {
  const due = dueLabel(action);
  const overdue = isOverdue(action);

  return (
    <tr
      className={`border-b border-line transition-colors duration-100 last:border-0 ${
        overdue ? "bg-bad-soft/40 hover:bg-bad-soft/60" : "hover:bg-surface-hover"
      }`}
    >
      <td className="px-lg py-sm">
        <button onClick={onOpen} className="text-left font-medium text-fg hover:underline">
          {action.title}
        </button>
      </td>
      <td className="px-lg py-sm text-fg-muted">{clientName}</td>
      <td className="px-lg py-sm text-fg-muted">{assigneeName}</td>
      <td
        className={`px-lg py-sm text-xs ${
          due.tone === "overdue"
            ? "font-medium text-bad-fg"
            : due.tone === "due"
              ? "font-medium text-warn-fg"
              : "text-fg-muted"
        }`}
      >
        {due.text}
      </td>
      <td className="px-lg py-sm">
        <Badge tone={STATUS_TONE[action.status]} dot>
          {ACTION_STATUS_LABEL[action.status]}
        </Badge>
      </td>
      <td className="px-lg py-sm text-right">
        {action.status !== "done" && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={onComplete}>
            Mark done
          </Button>
        )}
      </td>
    </tr>
  );
}
