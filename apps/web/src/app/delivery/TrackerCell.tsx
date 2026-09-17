import { memo, useEffect, useRef, useState } from "react";

import { DELIVERY_STAGE_COLORS } from "./api";
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
 * It keeps a local draft and reports it when typing pauses, and immediately on
 * blur, Tab or Shift+Enter — never on every keystroke: a request per character
 * would put the server in the middle of the user's typing, including its
 * validation errors, which would fire on every half-finished value.
 *
 * Text cells use a `<textarea>` that auto-expands vertically so long text is
 * always fully visible. Date and number cells stay as `<input>` because they
 * are single-line by nature.
 *
 * Escape restores the last committed value, which is the only undo a table
 * like this needs.
 */
/**
 * How long typing has to pause before a cell saves itself. Long enough not to
 * fire mid-word, short enough that little is lost if the tab closes.
 */
const AUTOSAVE_DELAY_MS = 800;

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

  // A background refetch or an import can change the row under an idle cell.
  // Only adopt it when the cell is not being typed in, so a save in flight
  // cannot yank the caret.
  //
  // `committed` is left alone while the cell has focus, which is the other half
  // of the same rule. It used to take whatever arrived, and an older response
  // landing mid-edit would set it to the value the user had just typed over —
  // so the pending autosave then saw draft === committed, decided there was
  // nothing to save, and the text was silently dropped on the next refetch.
  useEffect(() => {
    const next = toText(value);
    const activeEl = isTextColumn ? textareaRef.current : inputRef.current;
    if (document.activeElement === activeEl) return;
    committed.current = next;
    setDraft(next);
  }, [value, isTextColumn]);

  // onCommit is a fresh closure on every parent render, so the autosave below
  // reads it through a ref. Depending on it directly would restart the timer
  // each time the table re-rendered — which it does on every refetch — and a
  // cell edited while anything else was loading would never save itself.
  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  const commit = () => {
    if (draft === committed.current) return;
    committed.current = draft;
    onCommit(fromText(draft, column.type));
  };

  // Save shortly after typing stops, not only when the cell is left.
  //
  // Blur alone loses work in the ways people actually edit a sheet: typing a
  // note and then closing the tab, switching app or following a link never
  // fires it. A pause is the closest thing to "done" a cell can observe without
  // saving per keystroke, which would put the server — and its validation
  // errors — in the middle of a half-typed value.
  //
  // Blur, Tab and Shift+Enter still save immediately; they are a clearer signal
  // than a pause. When one of them wins the race, `committed` already matches
  // the draft and the pending timer finds nothing to do, so no cell is ever
  // saved twice.
  useEffect(() => {
    if (draft === committed.current) return;

    const timer = window.setTimeout(() => {
      if (draft === committed.current) return;
      committed.current = draft;
      onCommitRef.current(fromText(draft, column.type));
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [draft, column.type]);

  // Filtering the table, or anything else that unmounts a row, would otherwise
  // throw away text typed in the last moment before it went: the autosave timer
  // is cleared with the cell and blur never fires on a node that is removed.
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (draft === committed.current) return;
    committed.current = draft;
    onCommitRef.current(fromText(draft, column.type));
  };
  useEffect(() => () => flushRef.current(), []);

  // The input fills its cell edge to edge so the table's gridlines are the
  // only borders on screen — an input with its own border inside a bordered
  // cell reads as a form, not a sheet. Focus is a ring drawn inside the
  // cell, so selecting a cell never shifts the grid by a pixel.
  const baseClassName = `w-full border-0 bg-transparent px-sm text-sm text-fg outline-none transition-shadow duration-75 placeholder:text-fg-subtle focus:relative focus:z-10 focus:bg-surface focus:shadow-[inset_0_0_0_2px_rgb(var(--accent))] ${
    invalid ? "bg-bad-soft/40 shadow-[inset_0_0_0_1px_rgb(var(--bad-fg))]" : ""
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
        // The chosen stage tints its own cell, the way the sheet's conditional
        // formatting did. Options carry the same tint where the browser honours
        // it (Firefox does, Chrome does not) — the cell itself is what matters.
        className={`h-full min-h-[34px] cursor-pointer appearance-none font-medium ${
          DELIVERY_STAGE_COLORS[current] ?? ""
        } ${baseClassName}`}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option} className={DELIVERY_STAGE_COLORS[option] ?? ""}>
            {option}
          </option>
        ))}
        {/* A value the sheet's list does not contain — imported before the
            column had one. Offered so the cell shows what it actually holds and
            selecting another row's stage cannot silently drop it. */}
        {current !== "" && !options.includes(current) && <option value={current}>{current}</option>}
      </select>
    );
  }

  if (isTextColumn) {
    return (
      // The cell sizes itself to its text, in CSS, with nothing measured in JS.
      //
      // A hidden copy of the value shares one grid cell with the textarea. The
      // copy gives the grid its height and the textarea stretches to fill it,
      // so the browser does the wrapping and the measuring in the same layout
      // pass. That is what fixes long text showing only its first line: height
      // depends on width, and the old scrollHeight read happened once, at a
      // width the table column had not settled on yet, and never ran again when
      // the column later changed. This cannot fall out of step — resize the
      // window, widen a column, load a font late, paste a paragraph, and the
      // height simply follows.
      //
      // `w-0 min-w-full` is what keeps the copy from widening the column: a
      // definite zero width contributes nothing when the table works out its
      // intrinsic column sizes, while min-width still fills the real cell so
      // the text wraps exactly as it does in the textarea.
      //
      // The trailing space holds the last line open when the value ends in a
      // newline, which would otherwise collapse and hide it.
      <div className="grid min-h-[34px] w-full">
        <span
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 w-0 min-w-full whitespace-pre-wrap break-words px-sm py-[7px] text-sm leading-snug"
        >
          {draft + " "}
        </span>
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
          className={`${baseClassName} col-start-1 row-start-1 resize-none overflow-hidden break-words py-[7px] leading-snug`}
        />
      </div>
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
      className={`h-full min-h-[34px] ${baseClassName}`}
    />
  );
});

function toText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  // A DATE arrives as a full timestamp; a date input accepts only YYYY-MM-DD.
  if (typeof value === "string") return value.length > 10 ? value.slice(0, 10) : value;
  return String(value);
}

/** Empty means NULL, not "" or 0 — an untouched cell has no value, not a zero. */
function fromText(text: string, type: TrackerColumn["type"]): string | number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (type !== "number") return trimmed;

  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
