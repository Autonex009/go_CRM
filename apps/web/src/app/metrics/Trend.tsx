import type { MonthRow } from "./api";

/**
 * Deals opened per month, with the won share stacked inside each column.
 *
 * Inline SVG rather than a charting dependency, for the same reason as the
 * funnel: this is a dozen rectangles and two scales.
 */
export function Trend({ months }: { months: MonthRow[] }) {
  const peak = Math.max(1, ...months.map((m) => m.created));

  return (
    <div className="flex items-end gap-xs overflow-x-auto pb-xs" role="img"
      aria-label={`Deals opened per month, ${months.length} months`}>
      {months.map((m) => {
        const height = (m.created / peak) * 100;
        const wonShare = m.created > 0 ? (m.won / m.created) * 100 : 0;

        return (
          <div key={m.month} className="flex min-w-12 flex-1 flex-col items-center gap-xs">
            <span className="text-xs tabular-nums text-fg-muted">{m.created || ""}</span>

            <div
              className="relative flex h-32 w-full items-end rounded-t-sm bg-surface-muted"
              title={`${monthLabel(m.month)}: ${m.created} opened, ${m.won} won`}
            >
              {/* `relative` here, not only on the track: the won share is
                  positioned against this bar, and resolving it against an
                  ancestor instead would silently rescale it the moment the
                  outer layout changes. */}
              <div
                className="relative w-full rounded-t-sm bg-accent/30 transition-[height] duration-500 ease-out"
                style={{ height: `${Math.max(height, m.created > 0 ? 6 : 0)}%` }}
              >
                {/* Filled from the bottom of the same column, so the eye
                    compares won against what was opened rather than against a
                    second bar somewhere else. */}
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-sm bg-success-500"
                  style={{ height: `${wonShare}%` }}
                />
              </div>
            </div>

            <span className="text-[0.6875rem] text-fg-muted">{monthLabel(m.month)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** "Sep" — the axis has room for three letters and the year rarely changes
 *  inside one view. */
function monthLabel(month: string): string {
  const d = new Date(`${month}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? month
    : d.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
}
