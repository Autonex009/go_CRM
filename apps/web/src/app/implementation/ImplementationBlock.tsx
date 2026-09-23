import { Plus } from "lucide-react";

import { Avatar } from "../ui";
import { DeleteAskButton } from "./AskCard";
import type { Ask } from "./api";
import { PRIORITY_META, STATUS_META, isClosed } from "./meta";

/**
 * The Implementation section on a deal card.
 *
 * Its own tinted, bordered surface rather than another list of rows: GTM's
 * tasks and engineering's asks sit one above the other, and the colour is what
 * tells them apart at a glance.
 */
export function ImplementationBlock({
  asks,
  onAdd,
  onOpen,
  onDelete,
}: {
  asks: Ask[];
  onAdd?: () => void;
  onOpen?: (ask: Ask) => void;
  onDelete?: (ask: Ask) => void;
}) {
  const open = asks.filter((a) => !isClosed(a.status));
  if (open.length === 0 && !onAdd) return null;

  return (
    <div className="mt-2 rounded-lg border border-violet-500/25 bg-violet-500/[0.06] p-2 dark:bg-violet-400/[0.08]">
      {open.length === 0 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd?.();
          }}
          disabled={!onAdd}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-violet-500/30 py-1.5 text-[11px] font-medium text-violet-600/80 transition-colors enabled:hover:border-violet-500/60 enabled:hover:bg-violet-500/10 enabled:hover:text-violet-600 disabled:cursor-default disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45 dark:text-violet-300/80"
        >
          <Plus className="h-3 w-3" />
          Raise a tech ask
        </button>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {open.slice(0, 3).map((ask) => (
            <li
              key={ask.id}
              onClick={(e) => e.stopPropagation()}
              className="group flex items-start gap-0.5"
            >
              <button
                type="button"
                onClick={() => onOpen?.(ask)}
                className="min-w-0 flex-1 rounded-md p-1 text-left transition-colors hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45"
              >
                <span className="block whitespace-pre-wrap break-words text-xs leading-snug text-fg">
                  {ask.title}
                </span>

                {/* type · priority · assignee · status, in the order the spec
                    lists them. */}
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  {ask.type && <Chip className="bg-violet-500/15 text-violet-700 dark:text-violet-300">{ask.type}</Chip>}
                  <Chip className={PRIORITY_META[ask.priority].chip}>
                    {PRIORITY_META[ask.priority].label}
                  </Chip>
                  {ask.assignedToName && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-fg-muted">
                      <Avatar name={ask.assignedToName} size="xs" />
                      {ask.assignedToName.split(" ")[0]}
                    </span>
                  )}
                  <Chip className={statusChip(ask.status)}>
                    {STATUS_META[ask.status].label}
                    {ask.status === "blocked" && ask.blockedReason
                      ? ` · ${ask.blockedReason}`
                      : ""}
                  </Chip>
                </span>
              </button>
              {/* Beside the row, not inside it: buttons cannot nest. */}
              {onDelete && (
                <DeleteAskButton ask={ask} onDelete={onDelete} className="mt-1" />
              )}
            </li>
          ))}

          {open.length > 3 && (
            <li className="pl-1 text-[11px] text-fg-subtle">
              +{open.length - 3} more
            </li>
          )}

          {onAdd && (
            <li>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
                className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-medium text-violet-600/80 transition-colors hover:bg-violet-500/10 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45 dark:text-violet-300/80"
              >
                <Plus className="h-3 w-3" />
                Raise a tech ask
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${className}`}>
      {children}
    </span>
  );
}

function statusChip(status: Ask["status"]): string {
  switch (status) {
    case "blocked":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
    case "in_progress":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "delivered":
    case "verified":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    default:
      return "bg-surface text-fg-muted";
  }
}

/** "2 tech · 1 blocked" — the card's header chip. */
export function techSummary(asks: Ask[]): string | null {
  const open = asks.filter((a) => !isClosed(a.status));
  if (open.length === 0) return null;
  const blocked = open.filter((a) => a.status === "blocked").length;
  return blocked > 0
    ? `${open.length} tech · ${blocked} blocked`
    : `${open.length} tech`;
}
