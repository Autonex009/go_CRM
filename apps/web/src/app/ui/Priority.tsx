/**
 * The priority tick and the priority picker, shared by deal tasks and actions.
 *
 * The two lists sit side by side in a deal's working view, so they use one
 * control and one palette rather than two that merely look alike. Both are
 * generic over the level type: tasks and actions declare their own union and
 * their own meta, and neither has to know about the other.
 */
/**
 * Drawn when a level arrives that the caller's map has no entry for — an older
 * server that predates the field, or a value added to the database ahead of the
 * client. Neutral on purpose: inventing a colour would state an urgency nobody
 * chose, and crashing the whole list over one unknown label is worse than
 * either.
 */
const UNKNOWN: PriorityMeta = {
  label: "Normal",
  dot: "bg-fg-subtle",
  ring: "border-line",
  fill: "bg-fg-subtle",
};

export interface PriorityMeta {
  label: string;
  /** Background for the small dot in the picker. */
  dot: string;
  /** Border for the unticked circle. */
  ring: string;
  /** Background once it is ticked. */
  fill: string;
}

/**
 * The round, priority-tinted tick.
 *
 * Colour carries the urgency and the same control completes the item, so a row
 * stays one circle and one line of text.
 */
export function PriorityCheck<P extends string>({
  priority,
  meta,
  done,
  label,
  onToggle,
  disabled = false,
  children,
}: {
  priority: P;
  meta: Record<P, PriorityMeta>;
  done: boolean;
  /** What is being ticked, for the screen-reader label. */
  label: string;
  onToggle: () => void;
  disabled?: boolean;
  /** The tick mark itself, drawn by the caller. */
  children?: React.ReactNode;
}) {
  const m = meta[priority] ?? UNKNOWN;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      disabled={disabled}
      aria-label={`${m.label} priority — mark "${label}" ${done ? "not done" : "done"}`}
      title={`${m.label} priority`}
      onClick={onToggle}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${m.ring} ${
        done ? m.fill : "bg-transparent enabled:hover:scale-110"
      }`}
    >
      {children}
    </button>
  );
}

/** Cycles through the levels on click; the dot is the whole of the affordance. */
export function PriorityPicker<P extends string>({
  value,
  levels,
  meta,
  onChange,
}: {
  value: P;
  levels: readonly P[];
  meta: Record<P, PriorityMeta>;
  onChange: (next: P) => void;
}) {
  const m = meta[value] ?? UNKNOWN;
  // An unknown level is not in `levels`, so indexOf gives -1 and the first
  // click lands on the first real level — which is the way out of it.
  const next = levels[(levels.indexOf(value) + 1) % levels.length];

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`${m.label} priority — click for ${meta[next].label}`}
      className="flex shrink-0 items-center gap-1.5 rounded px-1.5 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-muted"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
      {m.label}
    </button>
  );
}
