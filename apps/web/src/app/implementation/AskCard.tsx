import { CalendarClock, Square, Trash2 } from "lucide-react";

import { Avatar } from "../ui";
import type { Ask } from "./api";
import { PRIORITY_META, companyTint, dueLabel, parentName } from "./meta";

/**
 * One card on the implementation board: the company it belongs to, what was
 * asked for, and the three things that decide whether to pick it up — priority,
 * when it is due, and whose it is.
 */
export function AskCard({
  ask,
  overlay = false,
  onDelete,
}: {
  ask: Ask;
  overlay?: boolean;
  onDelete?: (ask: Ask) => void;
}) {
  const due = dueLabel(ask);
  const blocked = ask.status === "blocked";

  return (
    <article
      className={`group flex flex-col gap-2 rounded-lg border bg-surface p-3 transition-all duration-150 ${
        overlay
          ? "rotate-1 scale-[1.02] border-accent/60 shadow-xl"
          : "border-line hover:-translate-y-px hover:border-accent/40 hover:shadow-md"
      } ${
        // A blocked card wears its state on its edge, so the column reads as
        // stuck work without anyone parsing the chips.
        blocked ? "border-l-[3px] border-l-rose-500" : ""
      }`}
    >
      <header className="flex items-center gap-1.5">
        <Square className="h-3 w-3 shrink-0 text-fg-subtle" />
        <span
          className={`min-w-0 flex-1 truncate text-[11px] font-semibold ${companyTint(parentName(ask))}`}
          title={parentName(ask)}
        >
          {parentName(ask)}
        </span>
        {ask.type && (
          <span
            className="max-w-[90px] shrink-0 truncate rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-fg-subtle"
            title={ask.type}
          >
            {ask.type}
          </span>
        )}
        {onDelete && !overlay && <DeleteAskButton ask={ask} onDelete={onDelete} />}
      </header>

      <p className="whitespace-pre-wrap break-words text-[13px] font-medium leading-snug text-fg">
        {ask.title}
      </p>

      {blocked && ask.blockedReason && (
        <p
          className="truncate rounded bg-rose-500/10 px-1.5 py-1 text-[11px] text-rose-600 dark:text-rose-400"
          title={ask.blockedReason}
        >
          {ask.blockedReason}
        </p>
      )}

      <footer className="flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${PRIORITY_META[ask.priority].chip}`}
        >
          {PRIORITY_META[ask.priority].label}
        </span>

        <span
          className={`inline-flex items-center gap-1 text-[11px] tabular-nums ${
            due.overdue
              ? "font-semibold text-rose-600 dark:text-rose-400"
              : "text-fg-muted"
          }`}
        >
          {due.text !== "—" && due.text !== "done" && (
            <CalendarClock className="h-3 w-3 shrink-0 opacity-70" />
          )}
          {due.text}
        </span>

        <span className="ml-auto shrink-0">
          {ask.assignedToName ? (
            <Avatar
              name={ask.assignedToName}
              title={`Assigned to ${ask.assignedToName}`}
              size="xs"
            />
          ) : (
            <span className="text-[10px] text-fg-subtle" title="Nobody is assigned">
              —
            </span>
          )}
        </span>
      </footer>
    </article>
  );
}

/**
 * A trash button that can sit inside a draggable or clickable card.
 *
 * It swallows the pointer and key events as well as the click: the board's
 * card is a dnd-kit drag source and the deal card opens on click, and either
 * would otherwise fire alongside the delete.
 */
export function DeleteAskButton({
  ask,
  onDelete,
  className = "",
}: {
  ask: Ask;
  onDelete: (ask: Ask) => void;
  className?: string;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <button
      type="button"
      onPointerDown={stop}
      onKeyDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onDelete(ask);
      }}
      aria-label={`Delete "${ask.title}"`}
      title="Delete ask"
      className={`shrink-0 rounded p-0.5 text-fg-subtle opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-500 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/45 group-hover:opacity-100 [@media(hover:none)]:opacity-100 ${className}`}
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
