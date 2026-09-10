import type { ReactNode } from "react";

import { Icon, type IconName } from "../../ui";

/**
 * One figure in a summary strip: a label, the number, and the one line of
 * context that stops the number being ambiguous.
 *
 * `onClick` makes the tile a way into the tab that details it. It is navigation,
 * never editing — nothing on the profile writes.
 */
export function StatTile({
  icon,
  label,
  value,
  hint,
  note,
  tone = "neutral",
  onClick,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  /** The emphasised sub-line — a total, a count, the thing worth reading next. */
  hint?: ReactNode;
  /** A quieter caveat below the hint, for partial or estimated figures. */
  note?: string;
  tone?: "neutral" | "brand" | "success" | "warning";
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-sm">
        <span className="flex min-w-0 items-center gap-xs text-xs font-medium text-fg-muted">
          <Icon name={icon} size={13} className="shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {onClick && (
          <Icon
            name="chevronLeft"
            size={13}
            className="shrink-0 rotate-180 text-fg-subtle transition-transform group-hover:translate-x-0.5"
          />
        )}
      </div>

      <div className="mt-sm text-xl font-semibold tracking-[-0.01em] text-fg">
        {value}
      </div>

      {hint && (
        <div className={`mt-xs truncate text-xs font-medium ${HINT[tone]}`}>
          {hint}
        </div>
      )}
      {note && (
        <div className="mt-0.5 truncate text-[11px] text-fg-subtle" title={note}>
          {note}
        </div>
      )}
    </>
  );

  const shell =
    "rounded-lg border border-line bg-surface p-md text-left shadow-sm";

  if (!onClick) {
    return <div className={shell}>{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group ${shell} transition-colors hover:border-accent/50 hover:bg-surface-hover`}
    >
      {body}
    </button>
  );
}

const HINT: Record<"neutral" | "brand" | "success" | "warning", string> = {
  neutral: "text-fg-muted",
  brand: "text-accent",
  success: "text-ok-fg",
  warning: "text-warn-fg",
};
