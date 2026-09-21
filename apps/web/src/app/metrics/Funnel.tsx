import { STAGE_META, type DealStage } from "../deals/stages";
import { formatMoneyCompact } from "../lib/money";
import type { StageRow } from "./api";

/**
 * The pipeline as a horizontal funnel: one bar per stage, scaled by count, with
 * the money and the camera count read off the same row.
 *
 * Drawn with plain divs rather than a chart library. The whole visual is one
 * width per row, and pulling in a charting dependency to compute a percentage
 * would cost more bundle than the entire page — see web/performance.md.
 */
export function Funnel({
  stages,
  currency,
  showValue,
}: {
  stages: StageRow[];
  currency: string;
  /** False when too few deals are priced for the money column to mean
   *  anything; the bar then carries counts and cameras alone. */
  showValue: boolean;
}) {
  // Scaled against the busiest stage, not the total: a funnel scaled to the sum
  // makes every bar a sliver as soon as the pipeline has more than a few stages.
  const peak = Math.max(1, ...stages.map((s) => s.count));

  return (
    <ol className="flex flex-col gap-sm">
      {stages.map((row) => {
        const meta = STAGE_META[row.stage as DealStage];
        const width = (row.count / peak) * 100;

        return (
          <li key={row.stage} className="grid grid-cols-[9rem_1fr] items-center gap-md">
            <span className="truncate text-sm text-fg-muted" title={meta?.label ?? row.stage}>
              {meta?.label ?? row.stage}
            </span>

            <div className="flex items-center gap-sm">
              <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-surface-muted">
                <div
                  className={`h-full rounded-md ${meta?.bar ?? "bg-accent"} transition-[width] duration-500 ease-out`}
                  // A stage with nothing in it still shows a hairline, so the
                  // row reads as an empty stage rather than a missing one.
                  style={{ width: `${Math.max(width, row.count > 0 ? 4 : 1.5)}%` }}
                />
                <span className="absolute inset-y-0 left-sm flex items-center text-xs font-medium text-fg mix-blend-luminosity">
                  {row.count > 0 ? row.count : ""}
                </span>
              </div>

              <dl className="flex w-40 shrink-0 justify-end gap-md text-right text-xs tabular-nums">
                {showValue && (
                  <div>
                    <dt className="sr-only">Value</dt>
                    <dd className="font-medium text-fg">
                      {row.value > 0 ? formatMoneyCompact(row.value, currency) : "—"}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="sr-only">Cameras</dt>
                  <dd className="text-fg-muted">{row.cameras > 0 ? `${row.cameras} cam` : "—"}</dd>
                </div>
              </dl>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
