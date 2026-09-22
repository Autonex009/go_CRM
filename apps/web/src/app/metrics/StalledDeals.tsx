import { Link } from "react-router-dom";

import { STAGE_META, type DealStage } from "../deals/stages";
import { formatMoneyCompact } from "../lib/money";
import { Badge, EmptyState } from "../ui";
import type { StalledRow } from "./api";

/**
 * Open deals nobody has touched in a fortnight, richest first.
 *
 * This is the one part of the page that is a to-do list rather than a
 * measurement: every other tile says how the quarter is going, and this one
 * says which five calls would change it.
 */
export function StalledDeals({
  rows,
  currency,
  showValue,
}: {
  rows: StalledRow[];
  currency: string;
  showValue: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="check"
        size="sm"
        title="Nothing is stuck"
        description="Every open deal has moved in the last two weeks."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line/60">
      {rows.map((d) => (
        <li key={d.dealId} className="flex items-center gap-md py-sm first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <Link
              to="/deals"
              className="truncate font-medium text-fg hover:text-accent hover:underline"
            >
              {d.title}
            </Link>
            <p className="truncate text-xs text-fg-muted">
              {[d.accountName, d.ownerName].filter(Boolean).join(" · ") || "Unassigned"}
            </p>
          </div>

          <Badge tone={STAGE_META[d.stage as DealStage]?.tone ?? "neutral"}>
            {STAGE_META[d.stage as DealStage]?.label ?? d.stage}
          </Badge>

          <div className="w-24 shrink-0 text-right text-sm tabular-nums">
            {showValue && d.amount > 0 ? (
              <span className="font-medium text-fg">{formatMoneyCompact(d.amount, currency)}</span>
            ) : (
              <span className="text-fg-muted">{d.cameras > 0 ? `${d.cameras} cam` : "—"}</span>
            )}
          </div>

          {/* The number that makes the row actionable, so it is the one drawn
              in the warning colour rather than the value. */}
          <span className="w-20 shrink-0 text-right text-xs font-medium tabular-nums text-warn-fg">
            {d.idleDays}d idle
          </span>
        </li>
      ))}
    </ul>
  );
}
