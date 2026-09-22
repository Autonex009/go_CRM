import { formatMoneyCompact } from "../lib/money";
import { Avatar } from "../ui";
import type { OwnerRow } from "./api";

/**
 * Who is carrying what: closed value first, then what is still open.
 *
 * Cameras are shown beside the money because most of this pipeline has a camera
 * count and only some of it has an amount — on a row where the value is blank,
 * the camera column is the one that says whether anything is happening.
 */
export function Leaderboard({
  owners,
  currency,
  showValue,
}: {
  owners: OwnerRow[];
  currency: string;
  showValue: boolean;
}) {
  const topOpen = Math.max(1, ...owners.map((o) => o.openCount + o.wonCount));

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs font-medium text-fg-muted">
          <th className="pb-sm font-medium">Owner</th>
          <th className="pb-sm text-right font-medium">Open</th>
          <th className="pb-sm text-right font-medium">Won</th>
          {showValue && <th className="pb-sm text-right font-medium">Won value</th>}
          <th className="pb-sm text-right font-medium">Cameras</th>
        </tr>
      </thead>
      <tbody>
        {owners.map((o) => (
          <tr key={o.ownerId || o.name} className="border-b border-line/50 last:border-0">
            <td className="py-sm">
              <div className="flex items-center gap-sm">
                <Avatar name={o.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{o.name}</p>
                  {/* A share bar rather than a second number: the point of the
                      row is how one person compares with the others. */}
                  <span
                    aria-hidden="true"
                    className="mt-1 block h-1 rounded-full bg-accent/40"
                    style={{ width: `${((o.openCount + o.wonCount) / topOpen) * 100}%` }}
                  />
                </div>
              </div>
            </td>
            <td className="py-sm text-right tabular-nums text-fg-muted">{o.openCount}</td>
            <td className="py-sm text-right tabular-nums font-medium text-fg">{o.wonCount}</td>
            {showValue && (
              <td className="py-sm text-right tabular-nums text-fg">
                {o.wonValue > 0 ? formatMoneyCompact(o.wonValue, currency) : "—"}
              </td>
            )}
            <td className="py-sm text-right tabular-nums text-fg-muted">{o.cameras || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
