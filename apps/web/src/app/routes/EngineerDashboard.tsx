import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  GitFork,
  Sparkles,
  Wrench,
} from "lucide-react";

import { useAuthStore } from "../auth/store";
import { AskDialog, type AskParent } from "../implementation/AskDialog";
import {
  implementationApi,
  type Ask,
  type AskInput,
  type AskStatus,
} from "../implementation/api";
import { isOverdue, PRIORITY_META, STATUS_META } from "../implementation/meta";
import { Alert, Card, EmptyState, Skeleton } from "../ui";

export function EngineerDashboard() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.trim().split(" ")[0] ?? user?.email?.split("@")[0];

  const [dialog, setDialog] = useState<Ask | null>(null);

  const { data: board, isLoading, isError, error } = useQuery({
    queryKey: ["implementation"],
    queryFn: () => implementationApi.board(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["implementation"] });
  };

  const move = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: AskStatus;
      reason?: string;
    }) => implementationApi.move(id, status, reason ?? ""),
    onSuccess: invalidate,
  });

  const save = useMutation({
    mutationFn: ({ id, input }: { id: string; input: AskInput }) =>
      implementationApi.update(id, input),
    onSuccess: invalidate,
  });

  const asks = board?.asks ?? [];

  const metrics = useMemo(() => {
    const active = asks.filter(
      (a) =>
        a.status === "requested" ||
        a.status === "acknowledged" ||
        a.status === "in_progress",
    ).length;
    const blocked = asks.filter((a) => a.status === "blocked").length;
    const completed = asks.filter(
      (a) => a.status === "delivered" || a.status === "verified",
    ).length;
    const overdue = asks.filter(isOverdue).length;

    return { active, blocked, completed, overdue, total: asks.length };
  }, [asks]);

  // Urgent/actionable tasks (active or blocked), sorted by priority then due date
  const urgentTasks = useMemo(() => {
    return [...asks]
      .filter((a) => a.status !== "delivered" && a.status !== "verified" && a.status !== "wont_do")
      .sort((a, b) => {
        // P0 first, then P1, then P2
        const pOrder: Record<string, number> = { p0: 0, p1: 1, p2: 2 };
        const pDiff = (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
        if (pDiff !== 0) return pDiff;
        if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return 0;
      });
  }, [asks]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      {/* Engineer Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              <h1 className="text-xl font-bold tracking-tight text-fg">
                {firstName ? `Welcome back, ${firstName}!` : "Engineer Dashboard"}
              </h1>
            </div>
            <p className="text-xs text-fg-muted">
              Here is your engineering task overview and active technical assignments.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/implementation"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              <Wrench className="h-4 w-4" />
              <span>Go to My Tasks Kanban</span>
            </Link>
          </div>
        </div>
      </div>

      {isError && (
        <Alert>
          {error instanceof Error ? error.message : "Could not load tasks"}
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-muted">Active Tasks</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 text-indigo-500">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-fg">
              {isLoading ? "—" : metrics.active}
            </h3>
            <p className="mt-1 text-xs text-fg-muted">In progress or requested</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-muted">Blocked Items</span>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                metrics.blocked > 0
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-500"
                  : "border-line bg-surface-muted text-fg-muted"
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3
              className={`text-2xl font-bold tracking-tight ${
                metrics.blocked > 0 ? "text-bad-fg" : "text-fg"
              }`}
            >
              {isLoading ? "—" : metrics.blocked}
            </h3>
            <p className="mt-1 text-xs text-fg-muted">
              {metrics.blocked > 0 ? "Action required to unblock" : "No blockers"}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-muted">Overdue Tasks</span>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                metrics.overdue > 0
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                  : "border-line bg-surface-muted text-fg-muted"
              }`}
            >
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3
              className={`text-2xl font-bold tracking-tight ${
                metrics.overdue > 0 ? "text-warn-fg" : "text-fg"
              }`}
            >
              {isLoading ? "—" : metrics.overdue}
            </h3>
            <p className="mt-1 text-xs text-fg-muted">Past scheduled due date</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-muted">Completed</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-fg">
              {isLoading ? "—" : metrics.completed}
            </h3>
            <p className="mt-1 text-xs text-fg-muted">Delivered or verified</p>
          </div>
        </div>
      </div>

      {/* Task Queue Card */}
      <Card className="p-5">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 className="text-sm font-semibold text-fg">Active Action Items</h2>
            <p className="text-xs text-fg-muted">
              Click any task to view requirements, manage sub-tasks, or update status.
            </p>
          </div>
          <Link
            to="/implementation"
            className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <span>Open Kanban Board</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3 pt-4">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : urgentTasks.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon="check"
              title="All caught up!"
              description="No active tasks assigned to you right now. Any tasks assigned by your manager will appear here."
            />
          </div>
        ) : (
          <div className="mt-4 divide-y divide-line/60">
            {urgentTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => setDialog(t)}
                className="group flex cursor-pointer flex-col gap-2 py-3 transition hover:bg-surface-hover/50 sm:flex-row sm:items-center sm:justify-between sm:px-2 rounded-lg"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        t.status === "blocked"
                          ? "bg-rose-500"
                          : t.status === "in_progress"
                          ? "bg-indigo-500"
                          : "bg-fg-subtle"
                      }`}
                    />
                    <span className="truncate text-sm font-semibold text-fg group-hover:text-accent">
                      {t.title}
                    </span>
                    {t.parentAskId && (
                      <span className="inline-flex items-center gap-1 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-fg-subtle">
                        <GitFork className="h-3 w-3" />
                        Sub-task
                      </span>
                    )}
                  </div>
                  {t.parentTitle && (
                    <p className="text-xs text-fg-subtle truncate pl-4">
                      Parent: {t.parentTitle}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2 pl-4 sm:pl-0">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      PRIORITY_META[t.priority]?.chip ?? ""
                    }`}
                  >
                    {PRIORITY_META[t.priority]?.label ?? t.priority}
                  </span>

                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      STATUS_META[t.status]?.pill ?? ""
                    }`}
                  >
                    {STATUS_META[t.status]?.label ?? t.status}
                  </span>

                  {t.dueAt && (
                    <span
                      className={`text-xs tabular-nums ${
                        isOverdue(t) ? "font-semibold text-bad-fg" : "text-fg-subtle"
                      }`}
                    >
                      {t.dueAt.slice(0, 10)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {dialog && (
        <AskDialog
          key={dialog.id}
          ask={dialog}
          parent={parentOf(dialog)}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync({ id: dialog.id, input })}
          onStatusChange={async (status, reason) => {
            await move.mutateAsync({ id: dialog.id, status, reason });
            setDialog(null);
          }}
          onSelectSubtask={(st) => setDialog(st)}
        />
      )}
    </motion.section>
  );
}

function parentOf(ask: Ask): AskParent {
  const company = ask.accountName ?? "";
  return {
    company: company || "Technical Delivery",
    label: company ? `${company} Implementation` : "Technical Task",
  };
}
