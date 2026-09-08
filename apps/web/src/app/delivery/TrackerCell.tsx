import { memo, useEffect, useRef, useState } from "react";

import type { TrackerColumn, TrackerInput } from "./api";

interface TrackerCellProps {
  column: TrackerColumn;
  value: TrackerInput[TrackerColumn["key"]];
  /** Fired on blur or Enter, never per keystroke — see the note below. */
  onCommit: (value: string | number | null) => void;
  /** Arrow/Tab navigation, handled by the table so it can move across rows. */
  onNavigate: (key: "up" | "down" | "left" | "right") => void;
  autoFocus?: boolean;
  invalid?: boolean;
  /** "row-col" address, used by the table to move focus around the grid. */
  cellId: string;
}

/**
 * One editable cell.
 *
 * It keeps a local draft and reports it on blur or Enter rather than on every
 * keystroke: a spreadsheet is edited by typing, and a PUT per character would
 * put the server in the middle of the user's typing — including its validation
 * errors, which would fire on every half-finished value.
 *
 * Escape restores the last committed value, which is the only undo a table
 * like this needs.
 */
export const TrackerCell = memo(function TrackerCell({
  column,
  value,
  onCommit,
  onNavigate,
  autoFocus,
  invalid,
  cellId,
}: TrackerCellProps) {
  const [draft, setDraft] = useState(() => toText(value));
  const ref = useRef<HTMLInputElement>(null);
  const committed = useRef(toText(value));

  // A background refetch or an import can change the row under an idle cell.
  // Only adopt it when the cell is not being typed in, so a save in flight
  // cannot yank the caret.
  useEffect(() => {
    const next = toText(value);
    committed.current = next;
    if (document.activeElement !== ref.current) setDraft(next);
  }, [value]);

  const commit = () => {
    if (draft === committed.current) return;
    committed.current = draft;
    onCommit(fromText(draft, column.type));
  };

  return (
    <input
      ref={ref}
      data-cell={cellId}
      type={column.type === "date" ? "date" : "text"}
      // Numbers stay a text input on purpose: type="number" swallows scroll
      // events into value changes, which in a scrollable table silently edits
      // whatever cell the pointer passes over.
      inputMode={column.type === "number" ? "numeric" : undefined}
      value={draft}
      autoFocus={autoFocus}
      aria-label={column.label}
      aria-invalid={invalid || undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        switch (e.key) {
          case "Enter":
            e.preventDefault();
            commit();
            onNavigate("down");
            break;
          case "Escape":
            e.preventDefault();
            setDraft(committed.current);
            ref.current?.blur();
            break;
          case "Tab":
            e.preventDefault();
            commit();
            onNavigate(e.shiftKey ? "left" : "right");
            break;
          case "ArrowUp":
          case "ArrowDown":
            // Left/right are not intercepted: they move the caret, which is
            // what you want while editing a cell's text.
            e.preventDefault();
            commit();
            onNavigate(e.key === "ArrowUp" ? "up" : "down");
            break;
        }
      }}
      // The input fills its cell edge to edge so the table's gridlines are the
      // only borders on screen — an input with its own border inside a bordered
      // cell reads as a form, not a sheet. Focus is a ring drawn inside the
      // cell, so selecting a cell never shifts the grid by a pixel.
      className={`h-[34px] w-full border-0 bg-transparent px-sm text-sm text-fg outline-none transition-shadow duration-75 placeholder:text-fg-subtle focus:relative focus:z-10 focus:bg-surface focus:shadow-[inset_0_0_0_2px_rgb(var(--accent))] ${
        invalid
          ? "bg-bad-soft/40 shadow-[inset_0_0_0_1px_rgb(var(--bad-fg))]"
          : ""
      } ${column.type === "number" ? "text-right tabular-nums" : ""}`}
    />
  );
});

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  // A DATE arrives as a full timestamp; a date input accepts only YYYY-MM-DD.
  if (typeof value === "string")
    return value.length > 10 ? value.slice(0, 10) : value;
  return String(value);
}

/** Empty means NULL, not "" or 0 — an untouched cell has no value, not a zero. */
function fromText(
  text: string,
  type: TrackerColumn["type"],
): string | number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (type !== "number") return trimmed;

  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
