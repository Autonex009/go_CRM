import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "../lib/api";
import { memberLabel, orgApi } from "../org/api";
import { Alert, Badge, Button, Field, Modal } from "../ui";
import type { Deal } from "./api";
import { getStageMeta, stageLabel } from "./stages";
import {
  PRIORITY_META,
  TASK_PRIORITIES,
  auditLine,
  byPriority,
  dealTasksApi,
  type DealTask,
  type TaskPriority,
} from "./tasks";

interface TasksDialogProps {
  deal: Deal;
  onClose: () => void;
}

/**
 * The deal's task checklist. Each edit is its own request rather than a single
 * "save" of the whole list: a task now carries who added it and who completed
 * it, and that only means anything if it is written when the thing happens.
 */
export function TasksDialog({ deal, onClose }: TasksDialogProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [draftPriority, setDraftPriority] = useState<TaskPriority>("normal");
  const [draftAssignee, setDraftAssignee] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tasks = useQuery({
    queryKey: ["dealTasks", deal.id],
    queryFn: () => dealTasksApi.list(deal.id),
  });

  const members = useQuery({
    queryKey: ["members"],
    queryFn: orgApi.members,
    staleTime: 5 * 60_000,
  });

  // Both the per-deal list and the board's all-deals list hang off "dealTasks".
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["dealTasks"] });
  };

  const settle = (fallback: string) => ({
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: unknown) => setError(err instanceof ApiError ? err.message : fallback),
  });

  const add = useMutation({
    mutationFn: () =>
      dealTasksApi.create({
        dealId: deal.id,
        text: draft.trim(),
        priority: draftPriority,
        assignedTo: draftAssignee || null,
      }),
    ...settle("Could not add that task"),
    onSuccess: () => {
      setError(null);
      setDraft("");
      setDraftPriority("normal");
      setDraftAssignee("");
      invalidate();
    },
  });

  const save = useMutation({
    mutationFn: ({ task, change }: { task: DealTask; change: Partial<DealTask> }) =>
      dealTasksApi.update(task.id, {
        text: change.text ?? task.text,
        priority: change.priority ?? task.priority,
        assignedTo: change.assignedTo !== undefined ? change.assignedTo : task.assignedTo,
        done: change.done ?? task.done,
      }),
    ...settle("Could not update that task"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => dealTasksApi.remove(id),
    ...settle("Could not delete that task"),
  });

  const items = byPriority(tasks.data ?? []);
  const pendingCount = items.filter((t) => !t.done).length;
  const memberOptions = members.data ?? [];

  const addTask = () => {
    if (draft.trim()) add.mutate();
  };

  return (
    <Modal title="Deal Tasks" onClose={onClose}>
      <div className="flex flex-col gap-md">
        {error && <Alert>{error}</Alert>}

        <div className="flex items-center justify-between gap-sm rounded-md border border-line bg-surface-muted p-sm">
          <span className="text-sm font-medium text-fg">
            {deal.title?.trim() || deal.accountName?.trim() || "Untitled deal"}
          </span>
          <Badge tone={getStageMeta(deal.stage).tone} dot>
            {stageLabel(deal.stage)}
          </Badge>
        </div>

        <div className="flex flex-col gap-xs">
          <span className="text-xs font-medium text-fg-muted">
            Tasks
            {items.length > 0 &&
              ` — ${pendingCount} pending, ${items.length - pendingCount} completed`}
          </span>

          {tasks.isPending && <p className="py-sm text-sm text-fg-subtle">Loading…</p>}

          {!tasks.isPending && items.length === 0 && (
            <p className="py-sm text-sm italic text-fg-subtle">
              No tasks yet. Add the first one below.
            </p>
          )}

          <ul className="flex flex-col gap-xs">
            {items.map((task) => {
              const audit = auditLine(task);
              return (
                <li
                  key={task.id}
                  className="flex items-start gap-sm rounded-md border border-line bg-surface p-xs"
                >
                  <div className="mt-[4px]">
                    <PriorityCheck
                      priority={task.priority}
                      done={task.done}
                      label={task.text}
                      onToggle={() => save.mutate({ task, change: { done: !task.done } })}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <TaskText
                      task={task}
                      onSave={(text) => save.mutate({ task, change: { text } })}
                    />
                    {audit && <span className="text-[10px] text-fg-subtle">{audit}</span>}
                  </div>

                  <select
                    value={task.assignedTo ?? ""}
                    onChange={(e) =>
                      save.mutate({ task, change: { assignedTo: e.target.value || null } })
                    }
                    aria-label={`Assignee for "${task.text}"`}
                    className="mt-[1px] h-7 max-w-32 shrink-0 rounded border border-line bg-surface px-1 text-xs text-fg-muted focus:border-accent focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {memberOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {memberLabel(m)}
                      </option>
                    ))}
                  </select>

                  <PriorityPicker
                    value={task.priority}
                    onChange={(priority) => save.mutate({ task, change: { priority } })}
                  />

                  <button
                    type="button"
                    onClick={() => remove.mutate(task.id)}
                    aria-label={`Remove "${task.text}"`}
                    className="mt-[5px] shrink-0 rounded p-1 text-fg-subtle transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-sm rounded-md border border-line bg-surface-muted/50 p-sm">
          <Field
            label="Add a task"
            placeholder="Call the customer about pricing…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTask();
              }
            }}
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-sm">
            <PriorityPicker value={draftPriority} onChange={setDraftPriority} />
            <select
              value={draftAssignee}
              onChange={(e) => setDraftAssignee(e.target.value)}
              aria-label="Assign the new task"
              className="h-8 max-w-40 rounded border border-line bg-surface px-2 text-xs text-fg-muted focus:border-accent focus:outline-none"
            >
              <option value="">Unassigned</option>
              {memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberLabel(m)}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addTask}
              disabled={!draft.trim() || add.isPending}
              className="ml-auto"
            >
              {add.isPending ? "Adding…" : "Add task"}
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-xs">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The round, priority-tinted tick. Colour carries the urgency and the same
 * control completes the task, so a row stays one circle and one line of text.
 */
/**
 * The editable task text.
 *
 * A textarea rather than an input, because a task is often a sentence: in a
 * single-line input everything past the visible width simply scrolled out of
 * sight, so a task you could not fully read was also one you could not check
 * was right. This wraps and grows instead.
 *
 * The height comes from a hidden copy of the text sharing one grid cell with
 * the textarea — the browser wraps and measures in the same layout pass, so the
 * row is always exactly as tall as its text, at any dialog width, with nothing
 * measured in JS. The trailing space holds the last line open when the text
 * ends in a newline.
 */
function TaskText({ task, onSave }: { task: DealTask; onSave: (text: string) => void }) {
  const [draft, setDraft] = useState(task.text);

  // Someone else's edit, or the server's own normalisation, arriving on a
  // refetch. Adopted only when this box is not being typed in.
  useEffect(() => {
    setDraft(task.text);
  }, [task.text]);

  const shared = `text-sm leading-snug ${task.done ? "text-fg-subtle line-through" : "text-fg"}`;

  return (
    <div className="grid">
      <span
        aria-hidden="true"
        className={`invisible col-start-1 row-start-1 w-0 min-w-full whitespace-pre-wrap break-words py-1 ${shared}`}
      >
        {draft + " "}
      </span>
      <textarea
        rows={1}
        value={draft}
        aria-label="Task"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const text = draft.trim();
          // An empty task is a delete by accident; put the old text back rather
          // than saving a row with no label.
          if (!text) return setDraft(task.text);
          if (text !== task.text) onSave(text);
        }}
        className={`col-start-1 row-start-1 w-full resize-none overflow-hidden break-words bg-transparent py-1 focus:outline-none ${shared}`}
      />
    </div>
  );
}

export function PriorityCheck({
  priority,
  done,
  label,
  onToggle,
  disabled = false,
}: {
  priority: TaskPriority;
  done: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      disabled={disabled}
      aria-label={`${meta.label} priority — mark "${label}" done`}
      title={`${meta.label} priority`}
      onClick={onToggle}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${meta.ring} ${
        done ? meta.fill : "bg-transparent enabled:hover:scale-110"
      }`}
    >
      {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
    </button>
  );
}

/** Cycles a task through the three priorities; the dot is the whole control. */
function PriorityPicker({
  value,
  onChange,
}: {
  value: TaskPriority;
  onChange: (next: TaskPriority) => void;
}) {
  const meta = PRIORITY_META[value];
  const next = TASK_PRIORITIES[(TASK_PRIORITIES.indexOf(value) + 1) % TASK_PRIORITIES.length];

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`${meta.label} priority — click for ${PRIORITY_META[next].label}`}
      className="flex shrink-0 items-center gap-1.5 rounded px-1.5 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-muted"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </button>
  );
}
