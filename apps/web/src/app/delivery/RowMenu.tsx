import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Icon } from "../ui";

export interface RowMenuTarget {
  /** Viewport coordinates of the right-click. */
  x: number;
  y: number;
  id: string;
  client: string;
}

interface RowMenuProps {
  target: RowMenuTarget;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Right-click menu for a tracker row.
 *
 * A spreadsheet is where people already right-click to delete a row, so the
 * gesture is worth supporting even though the row also carries a delete button:
 * the button is what you find by looking, this is what you find by habit.
 *
 * Positioned fixed against the viewport rather than the table, because the table
 * scrolls on both axes and an absolutely-placed menu would drift away from the
 * row it belongs to.
 */
export function RowMenu({ target, onDelete, onClose }: RowMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: target.x, y: target.y });

  // Nudge the menu back inside the viewport when the click was near an edge.
  // Measured after paint, before the browser shows the frame, so it never
  // appears in the wrong place first.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    setPos({
      x: Math.min(target.x, window.innerWidth - width - margin),
      y: Math.min(target.y, window.innerHeight - height - margin),
    });
  }, [target.x, target.y]);

  // preventScroll matters: plain autoFocus can emit a scroll event, and the
  // listener below treats any scroll as "close the menu" — the menu would shut
  // the instant it opened.
  useEffect(() => {
    itemRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    // Scroll closes rather than follows: the menu is anchored to a point in the
    // viewport, and the row moves out from under it.
    window.addEventListener("mousedown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for ${target.client}`}
      style={{ left: pos.x, top: pos.y }}
      // Stop the window listener above from closing the menu before the click
      // lands on an item.
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed z-50 min-w-[180px] overflow-hidden rounded-md border border-line bg-surface py-xs shadow-lg"
    >
      <p className="truncate px-md py-xs text-xs font-medium text-fg-subtle">
        {target.client}
      </p>
      <button
        type="button"
        ref={itemRef}
        role="menuitem"
        onClick={onDelete}
        className="flex w-full items-center gap-sm px-md py-sm text-left text-sm text-bad-fg transition-colors duration-100 hover:bg-bad-soft focus:bg-bad-soft focus:outline-none"
      >
        <Icon name="close" size={13} />
        Delete row
      </button>
    </div>
  );
}
