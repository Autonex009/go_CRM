import { useEffect } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional right-aligned control in the header (e.g. Delete). */
  headerAction?: ReactNode;
}

/**
 * Minimal centered dialog. Deliberately small: Escape and backdrop close, body
 * scroll locked, `role="dialog"` with a labelled title. Not a full focus trap —
 * if the portal grows more complex dialogs, swap the internals for a headless
 * library rather than growing this one.
 */
export function Modal({ title, onClose, children, headerAction }: ModalProps) {
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-neutral-900/40 p-md sm:p-xl"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Stop a click inside the card from reaching the backdrop handler.
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-neutral-900/10 bg-white shadow-lg"
      >
        <header className="flex items-center justify-between border-b border-neutral-900/10 px-lg py-md">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <div className="flex items-center gap-md">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md px-xs text-lg leading-none text-neutral-500 transition hover:text-neutral-900"
            >
              ×
            </button>
          </div>
        </header>
        <div className="p-lg">{children}</div>
      </div>
    </div>
  );
}
