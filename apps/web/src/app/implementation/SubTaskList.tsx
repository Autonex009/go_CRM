import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { GitFork } from "lucide-react";

import { useAuthStore } from "../auth/store";
import { orgApi, memberLabel } from "../org/api";
import {
  implementationApi,
  type Ask,
  type AskInput,
  type AskPriority,
  ASK_PRIORITIES,
} from "./api";
import { STATUS_META, PRIORITY_META } from "./meta";
import { Alert, Avatar, Button, Field, Modal, SelectField, TextareaField } from "../ui";

export function SubTaskList({
  parentAsk,
  onSelectSubtask,
}: {
  parentAsk: Ask;
  onSelectSubtask?: (subtask: Ask) => void;
}) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isEngineer = user?.role === "engineer";
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: subtasks = [], isLoading } = useQuery({
    queryKey: ["subtasks", parentAsk.id],
    queryFn: () => implementationApi.subtasks(parentAsk.id),
  });

  const doneCount = subtasks.filter(
    (s) => s.status === "delivered" || s.status === "verified",
  ).length;
  const progressPct =
    subtasks.length > 0 ? Math.round((doneCount / subtasks.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <GitFork className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-semibold text-fg">
            Connected Sub-tasks
          </span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-fg-subtle">
            {doneCount} / {subtasks.length}
          </span>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowAddModal(true)}
          icon="plus"
        >
          Add sub-task
        </Button>
      </div>

      {subtasks.length > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {isLoading ? (
        <p className="py-2 text-xs text-fg-subtle">Loading sub-tasks…</p>
      ) : subtasks.length === 0 ? (
        <p className="py-2 text-xs italic text-fg-subtle">
          No sub-tasks created yet. Break this main ask into engineering steps.
        </p>
      ) : (
        <div className="mt-1 divide-y divide-line/60 rounded-lg border border-line bg-surface">
          {subtasks.map((st) => (
            <div
              key={st.id}
              onClick={() => onSelectSubtask?.(st)}
              className={`flex items-center justify-between gap-3 p-2.5 text-xs transition-colors ${
                onSelectSubtask
                  ? "cursor-pointer hover:bg-surface-hover"
                  : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    st.status === "verified" || st.status === "delivered"
                      ? "bg-emerald-500"
                      : st.status === "blocked"
                      ? "bg-rose-500"
                      : "bg-indigo-500"
                  }`}
                />
                <span className="truncate font-medium text-fg">{st.title}</span>
                {(st.createdByRole === "engineer" || st.type?.toLowerCase() === "engineer") && (
                  <span className="shrink-0 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold">
                    Engineer
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    STATUS_META[st.status]?.pill ?? ""
                  }`}
                >
                  {STATUS_META[st.status]?.label ?? st.status}
                </span>

                {st.assignedToName ? (
                  <Avatar
                    name={st.assignedToName}
                    title={`Assigned to ${st.assignedToName}`}
                    size="xs"
                  />
                ) : (
                  <span className="text-[10px] text-fg-subtle">Unassigned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <CreateSubTaskModal
          parentAsk={parentAsk}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            void queryClient.invalidateQueries({
              queryKey: ["subtasks", parentAsk.id],
            });
            void queryClient.invalidateQueries({
              queryKey: ["implementation"],
            });
          }}
        />
      )}
    </div>
  );
}

function CreateSubTaskModal({
  parentAsk,
  onClose,
  onCreated,
}: {
  parentAsk: Ask;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const user = useAuthStore((s) => s.user);
  const isEngineer = user?.role === "engineer";
  const [priority, setPriority] = useState<AskPriority>(parentAsk.priority || "p1");
  const [assignedTo, setAssignedTo] = useState(isEngineer && user?.id ? user.id : "");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });

  // Filter assignees: show engineers and managers
  const assignees = members.filter(
    (m) => m.role === "engineer" || m.role === "manager" || m.role === "admin" || m.role === "owner",
  );

  const createMutation = useMutation({
    mutationFn: (input: AskInput) => implementationApi.create(input),
    onSuccess: () => onCreated(),
    onError: (err: any) => setError(err?.message || "Could not create sub-task"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title for the sub-task");
      return;
    }

    createMutation.mutate({
      parentAskId: parentAsk.id,
      dealId: parentAsk.dealId ?? undefined,
      leadId: parentAsk.leadId ?? undefined,
      title: title.trim(),
      type: parentAsk.type || "engineering",
      detail: detail.trim(),
      priority,
      assignedTo: assignedTo || undefined,
      dueAt: dueAt ? `${dueAt}T00:00:00Z` : null,
    });
  };

  return (
    <Modal title="Create Sub-Task" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="rounded-lg bg-surface-muted p-2.5 text-xs text-fg-muted">
          <span>Parent Ask: </span>
          <strong className="text-fg">{parentAsk.title}</strong>
        </div>

        <Field
          label="Sub-task Title"
          name="subtaskTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Implement webhook signature verification"
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Assign To Engineer"
            name="subtaskAssignee"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">Unassigned</option>
            {assignees.map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m)} ({m.role || "member"})
              </option>
            ))}
          </SelectField>

          <Field
            label="Due Date"
            name="subtaskDue"
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
          label="Technical Specifications / Notes"
          name="subtaskDetail"
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
            Create Sub-task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
