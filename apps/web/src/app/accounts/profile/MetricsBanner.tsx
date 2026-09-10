import { formatMoney } from "../../lib/money";
import { StatTile } from "./StatTile";
import type { ProfileMetrics } from "./metrics";
import type { ProfileTab } from "./tabs";

/**
 * The four figures that answer "where does this account stand" without
 * scrolling: what is still open, what has landed, what is feeding it, and what
 * is owed.
 *
 * Every number arrives on the `metrics` object, computed once for the page, so
 * these tiles and the tabs beneath them cannot disagree.
 */
export function MetricsBanner({
  metrics: m,
  currency,
  setActiveTab,
}: {
  metrics: ProfileMetrics;
  currency: string;
  setActiveTab: (tab: ProfileTab) => void;
}) {
  const unscoped = m.dealCount - m.scopedDeals;

  return (
    <div className="grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        icon="deals"
        label="Open pipeline"
        value={formatMoney(m.openValue, currency)}
        hint={`${m.openCount} ${m.openCount === 1 ? "deal" : "deals"} in play`}
        note={
          m.dealCount === 0
            ? undefined
            : `${m.dealCount} ${m.dealCount === 1 ? "deal" : "deals"} on record · ${formatMoney(m.dealValue, currency)} lifetime`
        }
        tone="brand"
        onClick={() => setActiveTab("pipeline")}
      />

      <StatTile
        icon="check"
        label="Closed won"
        value={formatMoney(m.wonValue, currency)}
        hint={
          m.dealCount > 0
            ? `${m.wonCount} of ${m.dealCount} won · ${Math.round((m.wonCount / m.dealCount) * 100)}% win rate`
            : "No deals yet"
        }
        tone="success"
        onClick={() => setActiveTab("pipeline")}
      />

      <StatTile
        icon="leads"
        label="Leads"
        value={m.leadCount}
        hint={
          m.leadEstimate > 0
            ? `${formatMoney(m.leadEstimate, currency)} estimated`
            : "Top of funnel"
        }
        note={
          m.totalCameras > 0
            ? `${m.totalCameras.toLocaleString()} cameras scoped${unscoped > 0 ? ` · ${unscoped} deal${unscoped === 1 ? "" : "s"} unscoped` : ""}`
            : undefined
        }
        tone="warning"
        onClick={() => setActiveTab("leads")}
      />

      <StatTile
        icon="trend"
        label="Billing"
        value={formatMoney(m.outstanding, currency)}
        hint={`${formatMoney(m.paid, currency)} collected of ${formatMoney(m.invoiced, currency)}`}
        note={`${m.quoteCount} ${m.quoteCount === 1 ? "quote" : "quotes"} · ${m.invoiceCount} ${m.invoiceCount === 1 ? "invoice" : "invoices"}`}
        tone={m.outstanding > 0 ? "warning" : "success"}
        onClick={() => setActiveTab("financials")}
      />
    </div>
  );
}
