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
  ShieldAlert,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import { useAuthStore } from "../auth/store";
import { ActivityCard } from "../dashboard/ActivityCard";
import { AskDialog, type AskParent } from "../implementation/AskDialog";
import {
  implementationApi,
  type Ask,
  type AskInput,
  type AskStatus,
} from "../implementation/api";
import { isOverdue, PRIORITY_META, STATUS_META } from "../implementation/meta";
import { Alert, Avatar, Badge, Card, EmptyState, Skeleton } from "../ui";

export function ManagerDashboard() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.trim().split(" ")[0] ?? user?.email?.split("@")[0];

  const [dialog, setDialog] = useState<Ask | null>(null);

  // Load implementation asks
  const {
    data: board,
    isLoading: boardLoading,
    isError: boardError,
    error: boardErr,
  } = useQuery({
    queryKey: ["implementation"],
    queryFn: () => implementationApi.board(),
  });

  // Load manager's team roster and workloads
  const {
    data: roster,
    isLoading: rosterLoading,
    isError: rosterError,
    error: rosterErr,
  } = useQuery({
    queryKey: ["managerRoster"],
    queryFn: () => implementationApi.managerRoster(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["implementation"] });
    void queryClient.invalidateQueries({ queryKey: ["managerRoster"] });
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
  const engineers = roster?.engineers ?? [];
  const unassignedSubtasks = roster?.unassignedSubtasks ?? [];

  // Team delivery metrics
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

    return {
      active,
      blocked,
      completed,
      overdue,
      total: asks.length,
      engineersCount: engineers.length,
    };
  }, [asks, engineers]);

  // Urgent action items: Blocked items first, then P0, then overdue
  const urgentAsks = useMemo(() => {
    return [...asks]
      .filter(
        (a) =>
          a.status !== "delivered" &&
          a.status !== "verified" &&
          a.status !== "wont_do",
      )
      .sort((a, b) => {
        // Blocked items need immediate manager attention
        if (a.status === "blocked" && b.status !== "blocked") return -1;
        if (b.status === "blocked" && a.status !== "blocked") return 1;

        // P0 first
        const pOrder: Record<string, number> = { p0: 0, p1: 1, p2: 2 };
        const pDiff = (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
        if (pDiff !== 0) return pDiff;

        // Due date
        if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return 0;
      });
  }, [asks]);

  const isLoading = boardLoading || rosterLoading;
  const isError = boardError || rosterError;
  const error = boardErr || rosterErr;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-6"
    >
      {/* Manager Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              <h1 className="text-xl font-bold tracking-tight text-fg">
                {firstName ? `Welcome back, ${firstName}!` : "Manager Dashboard"}
              </h1>
            </div>
            <p className="text-xs text-fg-muted">
              Technical Delivery Command Center — oversee engineer workload, active asks, and team execution.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/implementation"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-fg shadow-xs transition hover:bg-surface-hover"
            >
              <Wrench className="h-3.5 w-3.5 text-indigo-500" />
              <span>Implementation Board</span>
            </Link>
            <Link
              to="/implementation/team-tasks"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Engineer Tasks Matrix</span>
            </Link>
          </div>
        </div>
      </div>

      {isError && (
        <Alert>
          {error instanceof Error ? error.message : "Could not load technical delivery data"}
        </Alert>
      )}

      {/* Unassigned Subtasks Alert Banner */}
      {unassignedSubtasks.length > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              <strong>{unassignedSubtasks.length}</strong> technical sub-task{unassignedSubtasks.length === 1 ? "" : "s"} awaiting assignment to an engineer.
            </span>
          </div>
          <Link
            to="/implementation/team-tasks"
            className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 hover:underline shrink-0"
          >
            <span>Assign now</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* KPI Cards (Technical Delivery & Engineering Execution) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Active Tasks */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-muted">Active Implementation Tasks</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 text-indigo-500">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-fg">
              {isLoading ? "—" : metrics.active}
            </h3>
            <p className="mt-1 text-xs text-fg-muted">In execution or requested</p>
          </div>
        </div>

        {/* Team Engineers */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-muted">Reporting Engineers</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/20 to-purple-500/5 text-purple-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-fg">
              {isLoading ? "—" : metrics.engineersCount}
            </h3>
            <p className="mt-1 text-xs text-fg-muted">Assigned to your team</p>
          </div>
        </div>

        {/* Blocked Items */}
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
              {metrics.blocked > 0 ? "Requires manager intervention" : "Zero active blockers"}
            </p>
          </div>
        </div>

        {/* Delivered / Completed */}
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-muted">Delivered & Verified</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold tracking-tight text-fg">
              {isLoading ? "—" : metrics.completed}
            </h3>
            <p className="mt-1 text-xs text-fg-muted">Successfully shipped</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Team Capacity Roster & Urgent Tasks */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Team Workload & Roster Section */}
        <Card className="p-5 lg:col-span-7" padded={false}>
          <div className="flex items-center justify-between border-b border-line p-5">
            <div>
              <h2 className="text-sm font-semibold text-fg">Engineering Team Workload</h2>
              <p className="text-xs text-fg-muted">
                Reporting engineers capacity and current active workload.
              </p>
            </div>
            <Link
              to="/implementation/team-tasks"
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <span>Manage Allocations</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : engineers.length === 0 ? (
            <div className="py-10">
              <EmptyState
                icon="team"
                title="No reporting engineers yet"
                description="Assign engineers to your management roster in Team & Settings."
              />
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {engineers.map((eng) => {
                const loadStatus =
                  eng.blockedCount > 0
                    ? { label: "Has Blockers", tone: "danger" as const }
                    : eng.activeCount >= 5
                    ? { label: "High Load", tone: "warning" as const }
                    : eng.activeCount === 0
                    ? { label: "Available", tone: "success" as const }
                    : { label: "Optimal", tone: "info" as const };

                return (
                  <div
                    key={eng.engineerId}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition hover:bg-surface-hover/40"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={eng.engineerName || eng.engineerEmail} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-fg truncate">
                            {eng.engineerName || eng.engineerEmail.split("@")[0]}
                          </span>
                          <Badge tone={loadStatus.tone}>{loadStatus.label}</Badge>
                        </div>
                        <span className="text-xs text-fg-muted truncate block">
                          {eng.engineerEmail}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-fg">{eng.activeCount}</span>
                        <span className="text-fg-subtle">active</span>
                      </div>
                      {eng.blockedCount > 0 && (
                        <div className="flex items-center gap-1.5 text-rose-500 font-semibold">
                          <span>{eng.blockedCount}</span>
                          <span>blocked</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-fg">{eng.doneCount}</span>
                        <span className="text-fg-subtle">done</span>
                      </div>
                      <Link
                        to="/implementation/team-tasks"
                        className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-fg-muted hover:text-fg hover:bg-surface transition"
                      >
                        Tasks
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Urgent & Actionable Tasks */}
        <Card className="p-5 lg:col-span-5" padded={false}>
          <div className="flex items-center justify-between border-b border-line p-5">
            <div>
              <h2 className="text-sm font-semibold text-fg">Critical Action Items</h2>
              <p className="text-xs text-fg-muted">
                Tasks requiring unblocking or high-priority attention.
              </p>
            </div>
            <Link
              to="/implementation"
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <span>Board</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : urgentAsks.length === 0 ? (
            <div className="py-10">
              <EmptyState
                icon="check"
                title="All clear!"
                description="No blocked or pending high-priority asks requiring intervention."
              />
            </div>
          ) : (
            <div className="divide-y divide-line/60">
              {urgentAsks.slice(0, 6).map((t) => (
                <div
                  key={t.id}
                  onClick={() => setDialog(t)}
                  className="group flex cursor-pointer flex-col gap-2 p-3.5 transition hover:bg-surface-hover/50 sm:flex-row sm:items-center sm:justify-between"
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
                    {t.accountName && (
                      <p className="text-xs text-fg-subtle truncate pl-4">
                        Account: {t.accountName}
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

        {/* Technical Implementation Activity Feed */}
        <div className="lg:col-span-12">
          <ActivityCard />
        </div>
      </div>

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
    locations: ask.locations ?? undefined,
  };
}
