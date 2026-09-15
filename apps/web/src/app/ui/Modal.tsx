import { useEffect } from "react";
import type { ReactNode } from "react";

import { IconButton } from "./Button";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  headerAction?: ReactNode;
  /** `lg` for forms, `sm` for confirmations. */
  size?: "sm" | "lg";
}

const SIZES = { sm: "max-w-[420px]", lg: "max-w-[560px]" };

/**
 * Centered dialog. Escape and backdrop close, body scroll locked, labelled
 * `role="dialog"`.
 *
 * Entry animation is opacity + transform only — no width/height/top animation,
 * so it never triggers layout while the dialog appears. Not a full focus trap;
 * if the portal grows richer dialogs, swap the internals for a headless library
 * rather than growing this file.
 *
 * A tall dialog scrolls its own body: the header stays put and the content
 * moves under it. The backdrop used to be the scroller, which meant a long form
 * dragged its own title bar off the top of the screen and took the Save button
 * with it.
 */
export function Modal({ title, onClose, children, headerAction, size = "lg" }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-start justify-center overflow-hidden bg-overlay/40 p-md backdrop-blur-[2px] sm:items-center sm:p-xl"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-full w-full animate-scale-in flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg ${SIZES[size]}`}
      >
        <header className="flex shrink-0 items-center justify-between gap-md border-b border-line px-lg py-md">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <div className="flex items-center gap-sm">
            {headerAction}
            <IconButton name="close" label="Close" onClick={onClose} />
          </div>
        </header>
        {/* min-h-0 is what lets this shrink inside the flex column; without it
            the body claims its full content height and the dialog overflows the
            viewport instead of scrolling. overscroll-contain stops a scroll that
            reaches the end here from continuing on the page behind. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-lg">{children}</div>
      </div>
    </div>
  );
}
