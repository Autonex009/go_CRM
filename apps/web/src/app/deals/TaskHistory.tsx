import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

import { Skeleton } from "../ui";
import { PRIORITY_META, byPriority, dealTasksApi, type DealTask } from "./tasks";

/** "12 Sep, 4:30 pm" — short enough to sit inside a task row. */
function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface TaskHistoryProps {
  dealId: string;
}

/**
 * The deal's task list and its history, read-only.
 *
 * Editing happens on the card, where the work is; this is the record — what is
 * outstanding, what has been closed off, by whom and when. It shares its query
 * key with the board, so opening a deal costs no extra request once the board
 * has loaded.
 */
export function TaskHistory({ dealId }: TaskHistoryProps) {
  const [open, setOpen] = useState(true);

  const query = useQuery({
    queryKey: ["dealTasks", dealId],
    queryFn: () => dealTasksApi.list(dealId),
  });

  const tasks = query.data ?? [];
  const pending = byPriority(tasks.filter((t) => !t.done));
  // Most recently finished first — the history reads newest-at-the-top.
  const done = tasks
    .filter((t) => t.done)
    .sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));

  return (
    <section className="rounded-lg border border-line bg-surface-muted/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-sm px-sm py-xs text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Tasks
          {tasks.length > 0 && (
            <span className="ml-1.5 font-medium normal-case tracking-normal text-fg-subtle">
              {pending.length} pending · {done.length} done
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-xs border-t border-line/60 p-sm">
          {query.isPending && <Skeleton className="h-10 w-full" />}

          {!query.isPending && tasks.length === 0 && (
            <p className="text-xs italic text-fg-subtle">
              No tasks yet — add them from the deal card.
            </p>
          )}

          {pending.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}

          {done.length > 0 && pending.length > 0 && (
            <div className="mt-xs border-t border-line/50 pt-xs text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
              Completed
            </div>
          )}

          {done.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskRow({ task }: { task: DealTask }) {
  const meta = PRIORITY_META[task.priority];

  return (
    <div className="flex items-start gap-sm">
      <span
        title={`${meta.label} priority`}
        className={`mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${meta.ring} ${
          task.done ? meta.fill : ""
        }`}
      >
        {task.done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`whitespace-pre-wrap break-words text-sm leading-snug ${task.done ? "text-fg-subtle line-through" : "text-fg"}`}>
          {task.text}
        </p>

        {/* The audit trail: who it is on, who added it, who closed it. */}
        <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-fg-subtle">
          {task.assignedToName ? (
            <span className="font-medium text-fg-muted">{task.assignedToName}</span>
          ) : (
            <span className="italic">Unassigned</span>
          )}
          {task.createdByName && <span>· added by {task.createdByName}</span>}
          {task.done && task.completedByName && (
            <span>
              · done by {task.completedByName}
              {task.completedAt && ` on ${when(task.completedAt)}`}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
