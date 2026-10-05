import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, UserRoundX } from "lucide-react";

import { Avatar } from "../ui";

export interface AssigneeOption {
  id: string;
  name: string;
  /** A short second line, e.g. "4 active tasks". */
  hint?: string;
}

export interface AssigneeGroup {
  label: string;
  options: AssigneeOption[];
}

interface AssigneePickerProps {
  groups: AssigneeGroup[];
  /** The chosen id; "" for nobody. */
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Adds an "Unassigned" choice at the top. */
  allowUnassigned?: boolean;
  /** "sm" for inline use on a card, "md" for a form field. */
  size?: "sm" | "md";
  label?: string;
  disabled?: boolean;
}

const PANEL_WIDTH = 264;
const PANEL_MAX_HEIGHT = 320;
const GAP = 4;
/** Below this many people a search box is just noise. */
const SEARCH_THRESHOLD = 6;

type Row = { kind: "unassigned" } | { kind: "person"; option: AssigneeOption; group: string };

/**
 * Who should own this, as a searchable, scrollable list grouped by role.
 *
 * A panel rather than a native select: a select cannot be styled, cannot cap
 * its height, and cannot show who someone is at a glance. The panel renders in
 * a portal with fixed positioning, so a card's overflow-hidden or a modal's
 * scrolling body cannot clip it, and it flips above the trigger when there is
 * no room below.
 */
export function AssigneePicker({
  groups,
  value,
  onChange,
  placeholder = "Assign to…",
  allowUnassigned = false,
  size = "md",
  label,
  disabled = false,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const total = groups.reduce((n, g) => n + g.options.length, 0);
  const selected = useMemo(
    () => groups.flatMap((g) => g.options).find((o) => o.id === value) ?? null,
    [groups, value],
  );

  // Filtered groups, and the same rows flattened for keyboard movement.
  const { visible, rows } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = groups
      .map((g) => ({
        ...g,
        options: needle ? g.options.filter((o) => o.name.toLowerCase().includes(needle)) : g.options,
      }))
      .filter((g) => g.options.length > 0);
    const flat: Row[] = [];
    if (allowUnassigned && !needle) flat.push({ kind: "unassigned" });
    for (const g of filtered) for (const o of g.options) flat.push({ kind: "person", option: o, group: g.label });
    return { visible: filtered, rows: flat };
  }, [groups, query, allowUnassigned]);

  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, PANEL_WIDTH);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom;
    const up = below < PANEL_MAX_HEIGHT + GAP && r.top > below;
    setPos({ top: up ? r.top - GAP : r.bottom + GAP, left, width, up });
  }, []);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setQuery("");
    if (refocus) trigger.current?.focus();
  }, []);

  const choose = (row: Row) => {
    onChange(row.kind === "unassigned" ? "" : row.option.id);
    close();
  };

  // Open: position, start on the current choice, focus search (or the list).
  useLayoutEffect(() => {
    if (!open) return;
    place();
    const current = rows.findIndex((r) => (r.kind === "unassigned" ? value === "" : r.option.id === value));
    setActive(current >= 0 ? current : 0);
    requestAnimationFrame(() => (search.current ?? list.current)?.focus());
    // Deliberately keyed on `open` only: typing re-filters the list without
    // jumping the highlight back to the current choice.
  }, [open]);

  // Follow the trigger while the page or a modal body scrolls; close on a
  // click anywhere else.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) close(false);
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", away);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", away);
    };
  }, [open, place, close]);

  useEffect(() => setActive(0), [query]);

  // Keep the highlighted row in view as the arrow keys move it.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, rows.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(rows.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        if (rows[active]) choose(rows[active]);
        break;
      case "Escape":
        // Close only the picker — not the dialog it sits in, which listens
        // for Escape on the document.
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        close();
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  const triggerSize =
    size === "sm" ? "h-7 gap-1.5 rounded-md px-2 text-[11px]" : "h-9 gap-sm rounded-md px-sm text-sm";

  let rowIndex = -1;
  const nextIndex = () => ++rowIndex;

  return (
    <div className="flex min-w-0 flex-col gap-xs">
      {label && <span className="text-xs font-medium text-fg-muted">{label}</span>}

      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between border bg-surface text-left text-fg transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:cursor-not-allowed disabled:opacity-60 ${triggerSize} ${
          open ? "border-accent/60 ring-2 ring-accent/20" : "border-line"
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {selected && <Avatar name={selected.name} size="xs" />}
          <span className={`truncate ${selected ? "text-fg" : "text-fg-subtle"}`}>
            {selected?.name ?? placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panel}
            onKeyDown={onKeyDown}
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            }}
            className="z-[60] flex animate-fade-in flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-xl ring-1 ring-black/5"
          >
            {total > SEARCH_THRESHOLD && (
              <label className="flex items-center gap-2 border-b border-line px-2.5 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
                <span className="sr-only">Search people</span>
                <input
                  ref={search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people…"
                  maxLength={80}
                  className="w-full bg-transparent text-xs text-fg placeholder:text-fg-subtle focus:outline-none"
                />
              </label>
            )}

            <ul
              ref={list}
              role="listbox"
              tabIndex={-1}
              aria-label={label ?? placeholder}
              style={{ maxHeight: PANEL_MAX_HEIGHT - (total > SEARCH_THRESHOLD ? 40 : 0) }}
              className="overflow-y-auto overscroll-contain py-1 focus:outline-none"
            >
              {allowUnassigned && !query.trim() && (() => {
                const i = nextIndex();
                return (
                  <PickerRow
                    index={i}
                    active={i === active}
                    selected={value === ""}
                    onHover={() => setActive(i)}
                    onSelect={() => choose({ kind: "unassigned" })}
                  >
                    <span className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-line text-fg-subtle">
                      <UserRoundX className="h-3 w-3" />
                    </span>
                    <span className="truncate text-fg-muted">Unassigned</span>
                  </PickerRow>
                );
              })()}

              {visible.map((g) => (
                <li key={g.label} role="presentation">
                  <p className="sticky top-0 z-10 flex items-center justify-between bg-surface/95 px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle backdrop-blur-sm">
                    <span>{g.label}</span>
                    <span className="tabular-nums">{g.options.length}</span>
                  </p>
                  <ul role="group" aria-label={g.label}>
                    {g.options.map((o) => {
                      const i = nextIndex();
                      return (
                        <PickerRow
                          key={o.id}
                          index={i}
                          active={i === active}
                          selected={o.id === value}
                          onHover={() => setActive(i)}
                          onSelect={() => choose({ kind: "person", option: o, group: g.label })}
                        >
                          <Avatar name={o.name} size="xs" />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-fg">{o.name}</span>
                            {o.hint && <span className="truncate text-[10px] text-fg-subtle">{o.hint}</span>}
                          </span>
                        </PickerRow>
                      );
                    })}
                  </ul>
                </li>
              ))}

              {rows.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-fg-subtle">
                  {query ? `Nobody matches “${query}”` : "Nobody to assign yet"}
                </li>
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}

function PickerRow({
  index,
  active,
  selected,
  onHover,
  onSelect,
  children,
}: {
  index: number;
  active: boolean;
  selected: boolean;
  onHover: () => void;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <li
      role="option"
      aria-selected={selected}
      data-row={index}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={`mx-1 flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-xs transition-colors ${
        active ? "bg-surface-hover" : ""
      } ${selected ? "font-medium" : ""}`}
    >
      {children}
      {selected && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-accent" />}
    </li>
  );
}
