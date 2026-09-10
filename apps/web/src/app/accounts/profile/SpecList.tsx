/**
 * A label / value / caveat grid, for the fixed facts about a company.
 *
 * Replaces the sentences these panels used to be. A specification reads far
 * faster as a grid of labelled values than as prose, and the caveat line means a
 * partial figure can admit it instead of quietly looking complete.
 */
export function SpecList({
  items,
  columns = 2,
  className = "",
}: {
  items: { label: string; value: string; note?: string }[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <dl className={`grid gap-md ${GRID[columns]} ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
            {item.label}
          </dt>
          <dd
            className="mt-0.5 truncate text-sm font-semibold tabular-nums text-fg"
            title={item.value}
          >
            {item.value}
          </dd>
          {item.note && (
            <dd className="truncate text-[11px] text-fg-subtle" title={item.note}>
              {item.note}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

const GRID: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};
