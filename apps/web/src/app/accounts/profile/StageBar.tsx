import { formatMoney } from "../../lib/money";
import type { StageSlice } from "./metrics";

/**
 * Where the company's deals sit in the pipeline, as one bar plus a legend.
 *
 * Weighted by value rather than count: three discovery deals worth a thousand
 * each and one negotiation worth a hundred thousand is not an account that is
 * mostly in discovery, and a count-weighted bar would say it was.
 *
 * Only occupied stages are drawn — an empty sliver for every stage the company
 * has never been in is noise on a two-deal account.
 */
export function StageBar({
  stages,
  currency,
}: {
  stages: StageSlice[];
  currency: string;
}) {
  const total = stages.reduce((sum, s) => sum + s.value, 0);
  if (stages.length === 0) return null;

  // With no value anywhere, weight by count so the bar still says something.
  const weight = (s: StageSlice) =>
    total > 0 ? s.value / total : s.count / stages.reduce((n, x) => n + x.count, 0);

  return (
    <div className="flex flex-col gap-sm">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={stages
          .map((s) => `${s.label}: ${s.count}`)
          .join(", ")}
      >
        {stages.map((s) => (
          <div
            key={s.stage}
            className={s.bar}
            style={{ width: `${Math.max(weight(s) * 100, 2)}%` }}
            title={`${s.label} — ${s.count} deal${s.count === 1 ? "" : "s"}, ${formatMoney(s.value, currency)}`}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-md gap-y-xs">
        {stages.map((s) => (
          <li
            key={s.stage}
            className="flex items-center gap-xs text-xs text-fg-muted"
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${s.bar}`} />
            <span className="text-fg">{s.label}</span>
            <span className="tabular-nums text-fg-subtle">
              {s.count} · {formatMoney(s.value, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
