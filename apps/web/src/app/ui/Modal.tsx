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
      className="fixed inset-0 z-50 flex animate-fade-in items-start justify-center overflow-y-auto bg-neutral-900/30 p-md backdrop-blur-[2px] sm:p-xl"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full animate-scale-in rounded-xl border border-neutral-200 bg-white shadow-lg ${SIZES[size]}`}
      >
        <header className="flex items-center justify-between gap-md border-b border-neutral-200 px-lg py-md">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <div className="flex items-center gap-sm">
            {headerAction}
            <IconButton name="close" label="Close" onClick={onClose} />
          </div>
        </header>
        <div className="p-lg">{children}</div>
      </div>
    </div>
  );
}
