import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  GitFork,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";

import { useAuthStore } from "../auth/store";
import {
  implementationApi,
  type Ask,
  type AskInput,
  type AskPriority,
  type EngineerWorkload,
  ASK_PRIORITIES,
} from "../implementation/api";
import { STATUS_META, PRIORITY_META } from "../implementation/meta";
import { memberLabel, orgApi, type Member } from "../org/api";
import { AssigneePicker, type AssigneeGroup } from "../implementation/AssigneePicker";
import {
  Alert,
  Avatar,
  Button,
  EmptyState,
  Field,
  Modal,
  SelectField,
  TextareaField,
} from "../ui";

export default function ManagerTeamTasks() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assignModal, setAssignModal] = useState<{
    open: boolean;
    engineerId?: string;
    subtask?: Ask;
  }>({ open: false });

  const isManagerOrAdmin =
    user?.role === "manager" ||
    user?.role === "owner" ||
    user?.role === "admin";

  // Owners and admins can also hand work to engineering managers (e.g. a lead
  // who will split it across their team). Managers keep assigning within
  // their own team only.
  const canAssignManagers = user?.role === "owner" || user?.role === "admin";
  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
    enabled: canAssignManagers,
  });
  const managers = canAssignManagers
    ? (members.data ?? []).filter((m) => m.role === "manager")
    : [];

  const { data: roster, isLoading, isError, error } = useQuery({
    queryKey: ["managerRoster"],
    queryFn: () => implementationApi.managerRoster(),
    enabled: isManagerOrAdmin,
  });

  const engineers = roster?.engineers ?? [];
  const unassigned = roster?.unassignedSubtasks ?? [];

  // Summary counts
  const totalEngineers = engineers.length;
  const totalActiveTasks = engineers.reduce((sum, e) => sum + e.activeCount, 0);
  const totalBlockedTasks = engineers.reduce((sum, e) => sum + e.blockedCount, 0);
  const totalDoneTasks = engineers.reduce((sum, e) => sum + e.doneCount, 0);

  // Filter tasks inside each engineer based on filters
  const filteredEngineers = useMemo(() => {
    return engineers.map((eng) => {
      const filteredTasks = eng.activeTasks.filter((task) => {
        if (search) {
          const matchTitle = task.title.toLowerCase().includes(search.toLowerCase());
          const matchParent = (task.parentTitle ?? "").toLowerCase().includes(search.toLowerCase());
          if (!matchTitle && !matchParent) return false;
        }
        if (statusFilter !== "all" && task.status !== statusFilter) return false;
        if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
        return true;
      });
      return {
        ...eng,
        displayTasks: filteredTasks,
      };
    });
  }, [engineers, search, statusFilter, priorityFilter]);

  const quickAssignMutation = useMutation({
    mutationFn: ({ task, assigneeId }: { task: Ask; assigneeId: string }) => {
      return implementationApi.update(task.id, {
        title: task.title,
        type: task.type,
        detail: task.detail,
        priority: task.priority,
        assignedTo: assigneeId,
        dueAt: task.dueAt,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["managerRoster"] });
      void queryClient.invalidateQueries({ queryKey: ["implementation"] });
    },
  });

  if (!isManagerOrAdmin) {
    return (
      <div className="p-6">
        <Alert>
          You do not have permission to view the Manager Team Workload page.
        </Alert>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      {/* Page Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-fg">
            Engineer Task Allocations
          </h1>
          <p className="text-xs text-fg-muted mt-0.5">
            Monitor engineering workloads, sub-task delegations, and team capacity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={() => setAssignModal({ open: true })}
          >
            Create & Assign Task
          </Button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col rounded-xl border border-line bg-surface p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-fg-subtle">
            <span>Team Engineers</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <span className="mt-1 text-2xl font-bold tracking-tight text-fg">
            {totalEngineers}
          </span>
        </div>

        <div className="flex flex-col rounded-xl border border-line bg-surface p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-fg-subtle">
            <span>Active Tasks</span>
            <Clock className="h-4 w-4 text-sky-500" />
          </div>
          <span className="mt-1 text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
            {totalActiveTasks}
          </span>
        </div>

        <div className="flex flex-col rounded-xl border border-line bg-surface p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-fg-subtle">
            <span>Blocked Tasks</span>
            <ShieldAlert className="h-4 w-4 text-rose-500" />
          </div>
          <span className="mt-1 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
            {totalBlockedTasks}
          </span>
        </div>

        <div className="flex flex-col rounded-xl border border-line bg-surface p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-xs text-fg-subtle">
            <span>Delivered / Done</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {totalDoneTasks}
          </span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or parent asks…"
            className="h-8 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-xs text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs text-fg focus:border-accent focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs text-fg focus:border-accent focus:outline-none"
        >
          <option value="all">All Priorities</option>
          <option value="p0">P0 (Urgent)</option>
          <option value="p1">P1 (High)</option>
          <option value="p2">P2 (Normal)</option>
        </select>
      </div>

      {isError && (
        <Alert>
          {error instanceof Error ? error.message : "Could not load manager roster"}
        </Alert>
      )}

      {/* Unassigned Tasks Banner (if any) */}
      {unassigned.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                {unassigned.length} Sub-task(s) need engineer assignment
              </span>
            </div>
          </div>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {unassigned.map((task) => (
              <div
                key={task.id}
                className="flex flex-col justify-between gap-2 rounded-lg border border-line bg-surface p-2.5 text-xs shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-medium text-fg-subtle truncate">
                      ↳ Parent: {task.parentTitle || "Main Ask"}
                    </span>
                    <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${PRIORITY_META[task.priority].chip}`}>
                      {PRIORITY_META[task.priority].label}
                    </span>
                  </div>
                  <p className="font-medium text-fg">{task.title}</p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <AssigneePicker
                    size="sm"
                    groups={assigneeGroups(engineers, managers)}
                    value=""
                    placeholder={managers.length > 0 ? "Assign to…" : "Assign to engineer…"}
                    disabled={quickAssignMutation.isPending}
                    onChange={(id) => {
                      if (id) quickAssignMutation.mutate({ task, assigneeId: id });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engineer Roster Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl border border-line bg-surface-muted/30"
            />
          ))}
        </div>
      ) : totalEngineers === 0 ? (
        <EmptyState
          icon="team"
          title="No engineers found under your team"
          description="In the Team & Settings page, assign engineers to report to you to track their allocations here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEngineers.map((eng) => (
            <div
              key={eng.engineerId}
              className="flex flex-col rounded-xl border border-line bg-surface shadow-sm overflow-hidden"
            >
              {/* Engineer Header */}
              <div className="flex items-center justify-between border-b border-line bg-surface-muted/30 p-3.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={eng.engineerName} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-fg">
                      {eng.engineerName}
                    </p>
                    <p className="truncate text-[10px] text-fg-subtle">
                      {eng.engineerEmail}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-semibold tabular-nums shrink-0">
                  <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-sky-600 dark:text-sky-400">
                    {eng.activeCount} active
                  </span>
                  {eng.blockedCount > 0 && (
                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-600 dark:text-rose-400">
                      {eng.blockedCount} blocked
                    </span>
                  )}
                </div>
              </div>

              {/* Task List */}
              <div className="flex-1 divide-y divide-line/60 overflow-y-auto p-2 max-h-[360px] min-h-[140px]">
                {eng.displayTasks.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-6 text-center text-xs text-fg-subtle">
                    <span>No active tasks matching filter</span>
                  </div>
                ) : (
                  eng.displayTasks.map((t) => (
                    <div
                      key={t.id}
                      className="group flex flex-col gap-1.5 rounded-lg p-2.5 transition-colors hover:bg-surface-hover"
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <span
                          className={`rounded px-1.5 py-0.5 font-bold ${
                            PRIORITY_META[t.priority]?.chip ?? ""
                          }`}
                        >
                          {PRIORITY_META[t.priority]?.label ?? t.priority}
                        </span>

                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${
                            STATUS_META[t.status]?.pill ?? ""
                          }`}
                        >
                          {STATUS_META[t.status]?.label ?? t.status}
                        </span>

                        {(t.createdByRole === "engineer" || t.type?.toLowerCase() === "engineer") && (
                          <span
                            className="rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-1.5 py-0.5 font-semibold"
                            title={`Engineer's card${t.createdByName ? ` · created by ${t.createdByName}` : ""}`}
                          >
                            Engineer
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-medium text-fg leading-snug">
                        {t.title}
                      </p>

                      {t.parentTitle && (
                        <div className="flex items-center gap-1 text-[10px] text-fg-subtle truncate">
                          <GitFork className="h-2.5 w-2.5 shrink-0 text-indigo-400" />
                          <span className="truncate">↳ {t.parentTitle}</span>
                        </div>
                      )}

                      {t.status === "blocked" && t.blockedReason && (
                        <p className="truncate rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-600 dark:text-rose-400">
                          {t.blockedReason}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Card Footer: Quick Add Action */}
              <div className="border-t border-line bg-surface p-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                  icon="plus"
                  onClick={() =>
                    setAssignModal({
                      open: true,
                      engineerId: eng.engineerId,
                    })
                  }
                >
                  Assign task to {eng.engineerName.split(" ")[0]}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for creating a new task / subtask directly */}
      {assignModal.open && (
        <CreateTeamTaskModal
          preselectedEngineerId={assignModal.engineerId}
          engineers={engineers}
          managers={managers}
          onClose={() => setAssignModal({ open: false })}
          onCreated={() => {
            setAssignModal({ open: false });
            void queryClient.invalidateQueries({ queryKey: ["managerRoster"] });
            void queryClient.invalidateQueries({ queryKey: ["implementation"] });
          }}
        />
      )}
    </section>
  );
}

/**
 * Assignee choices: the team's engineers, plus — for owners and admins — the
 * engineering managers, each in their own group so the two are not confused.
 */
function assigneeGroups(engineers: EngineerWorkload[], managers: Member[]): AssigneeGroup[] {
  const groups: AssigneeGroup[] = [
    {
      label: "Engineers",
      options: engineers.map((eng) => ({
        id: eng.engineerId,
        name: eng.engineerName,
        hint: `${eng.activeCount} active task${eng.activeCount === 1 ? "" : "s"}`,
      })),
    },
  ];
  if (managers.length > 0) {
    groups.push({
      label: "Managers",
      options: managers.map((m) => ({ id: m.id, name: memberLabel(m), hint: "Engineering manager" })),
    });
  }
  return groups;
}

function CreateTeamTaskModal({
  preselectedEngineerId,
  engineers,
  managers,
  onClose,
  onCreated,
}: {
  preselectedEngineerId?: string;
  engineers: EngineerWorkload[];
  managers: Member[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [parentAskId, setParentAskId] = useState("");
  const [detail, setDetail] = useState("");
  const [priority, setPriority] = useState<AskPriority>("p1");
  const [assignedTo, setAssignedTo] = useState(preselectedEngineerId ?? "");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch top-level asks to connect as parent
  const { data: board } = useQuery({
    queryKey: ["implementation"],
    queryFn: () => implementationApi.board({ openOnly: true }),
  });

  const parentAsks = (board?.asks ?? []).filter((a) => !a.parentAskId);

  const createMutation = useMutation({
    mutationFn: (input: AskInput) => implementationApi.create(input),
    onSuccess: () => onCreated(),
    onError: (err: any) => setError(err?.message || "Could not create task"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a task title");
      return;
    }
    if (!parentAskId) {
      setError("Please connect this sub-task to a main ask");
      return;
    }

    createMutation.mutate({
      parentAskId,
      title: title.trim(),
      type: "engineering",
      detail: detail.trim(),
      priority,
      assignedTo: assignedTo || undefined,
      dueAt: dueAt ? `${dueAt}T00:00:00Z` : null,
    });
  };

  return (
    <Modal title="Assign Task to Engineer" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <SelectField
          label="Connect to Main Ask (Parent)"
          name="parentAsk"
          value={parentAskId}
          onChange={(e) => setParentAskId(e.target.value)}
        >
          <option value="">Select a main ask…</option>
          {parentAsks.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} ({a.accountName || "Tech Ask"})
            </option>
          ))}
        </SelectField>

        <Field
          label="Task / Sub-task Title"
          name="taskTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Build backend schema migration and API endpoint"
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <AssigneePicker
            label="Assignee"
            groups={assigneeGroups(engineers, managers)}
            value={assignedTo}
            onChange={setAssignedTo}
            placeholder="Unassigned"
            allowUnassigned
          />

          <Field
            label="Due Date"
            name="due"
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-fg-muted">Priority</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface-muted/60 p-1">
            {ASK_PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                  priority === p
                    ? PRIORITY_META[p].chip
                    : "text-fg-muted hover:text-fg"
                }`}
              >
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
        </div>

        <TextareaField
          label="Technical Specification / Acceptance Criteria"
          name="detail"
          rows={3}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Detailed tech requirements, endpoints, acceptance criteria…"
        />

        {error && <Alert>{error}</Alert>}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending} icon="check">
            Assign Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
