import { memo, useCallback, useEffect, useRef, useState } from "react";

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
 * Text cells use a `<textarea>` that auto-expands vertically so long text is
 * always fully visible. Date and number cells stay as `<input>` because they
 * are single-line by nature.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committed = useRef(toText(value));

  const isTextColumn = column.type === "text";
  const isSelectColumn = column.type === "select";

  // Auto-resize the textarea to fit its content.
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Reset height to auto so scrollHeight recalculates from content, not
    // from the previous height.
    el.style.height = "auto";
    el.style.height = `${Math.max(34, el.scrollHeight)}px`;
  }, []);

  // A background refetch or an import can change the row under an idle cell.
  // Only adopt it when the cell is not being typed in, so a save in flight
  // cannot yank the caret.
  useEffect(() => {
    const next = toText(value);
    committed.current = next;
    const activeEl = isTextColumn ? textareaRef.current : inputRef.current;
    if (document.activeElement !== activeEl) setDraft(next);
  }, [value, isTextColumn]);

  // Re-measure the textarea whenever the draft changes.
  useEffect(() => {
    if (isTextColumn) autoResize();
  }, [draft, isTextColumn, autoResize]);

  const commit = () => {
    if (draft === committed.current) return;
    committed.current = draft;
    onCommit(fromText(draft, column.type));
  };

  // The input fills its cell edge to edge so the table's gridlines are the
  // only borders on screen — an input with its own border inside a bordered
  // cell reads as a form, not a sheet. Focus is a ring drawn inside the
  // cell, so selecting a cell never shifts the grid by a pixel.
  const baseClassName = `w-full border-0 bg-transparent px-sm text-sm text-fg outline-none transition-shadow duration-75 placeholder:text-fg-subtle focus:relative focus:z-10 focus:bg-surface focus:shadow-[inset_0_0_0_2px_rgb(var(--accent))] ${
    invalid
      ? "bg-bad-soft/40 shadow-[inset_0_0_0_1px_rgb(var(--bad-fg))]"
      : ""
  } ${column.type === "number" ? "text-right tabular-nums" : ""}`;

  if (isSelectColumn) {
    // Widened to string[]: the const assertion on the options list narrows them
    // to a literal union, which cannot be compared against a stored value.
    const options: readonly string[] = column.options ?? [];
    const current = toText(value);
    return (
      <select
        data-cell={cellId}
        value={current}
        autoFocus={autoFocus}
        aria-label={column.label}
        aria-invalid={invalid || undefined}
        // Committed on change rather than on blur: there is no half-typed state
        // to protect, and picking from a list is already the deliberate act that
        // blur stands in for on a text cell.
        onChange={(e) => onCommit(e.target.value === "" ? null : e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            onNavigate(e.shiftKey ? "left" : "right");
          }
        }}
        className={`h-[34px] cursor-pointer appearance-none ${baseClassName}`}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        {/* A value the sheet's list does not contain — imported before the
            column had one. Offered so the cell shows what it actually holds and
            selecting another row's stage cannot silently drop it. */}
        {current !== "" && !options.includes(current) && (
          <option value={current}>{current}</option>
        )}
      </select>
    );
  }

  if (isTextColumn) {
    return (
      <textarea
        ref={textareaRef}
        data-cell={cellId}
        value={draft}
        autoFocus={autoFocus}
        aria-label={column.label}
        aria-invalid={invalid || undefined}
        rows={1}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          switch (e.key) {
            case "Enter":
              if (e.shiftKey) {
                // Shift+Enter = commit and move down (like a spreadsheet)
                e.preventDefault();
                commit();
                onNavigate("down");
              }
              // Plain Enter = newline (natural textarea behavior)
              break;
            case "Escape":
              e.preventDefault();
              setDraft(committed.current);
              textareaRef.current?.blur();
              break;
            case "Tab":
              e.preventDefault();
              commit();
              onNavigate(e.shiftKey ? "left" : "right");
              break;
          }
        }}
        className={`${baseClassName} resize-none overflow-hidden py-[7px] leading-snug`}
        style={{ minHeight: "34px" }}
      />
    );
  }

  return (
    <input
      ref={inputRef}
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
            inputRef.current?.blur();
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
      className={`h-[34px] ${baseClassName}`}
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
