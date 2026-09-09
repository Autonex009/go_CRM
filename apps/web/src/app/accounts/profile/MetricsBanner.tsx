import type {
  LinkedDeal,
  LinkedInvoice,
  LinkedLead,
  LinkedQuote,
} from "../api";
import type { ProfileTab } from "./tabs";

/**
 * The four-up metric strip at the top of the Overview tab.
 *
 * Each card is a button into the tab that details it, so the numbers are a way
 * in rather than a dead end. The totals arrive as props because they are summed
 * once on the page and shown in more than one tab.
 */
export function MetricsBanner({
  deals,
  leads,
  quotes,
  invoices,
  totalDealAmount,
  totalCameras,
  scopedDeals,
  totalLeadEstimate,
  setActiveTab,
}: {
  deals: LinkedDeal[];
  leads: LinkedLead[];
  quotes: LinkedQuote[];
  invoices: LinkedInvoice[];
  totalDealAmount: number;
  totalCameras: number;
  /** How many deals carry a camera count, so a partial total can admit it. */
  scopedDeals: number;
  totalLeadEstimate: number;
  setActiveTab: (tab: ProfileTab) => void;
}) {
  return (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
    {/* Active Deals Metric Card */}
    <div
      onClick={() => setActiveTab("pipeline")}
      className="p-md rounded-xl border border-line bg-surface hover:border-brand/40 transition-all cursor-pointer shadow-xs group"
    >
      <div className="flex items-center justify-between text-xs text-fg-muted">
        <span className="font-medium">Active Deals</span>
        <span className="text-brand font-semibold group-hover:translate-x-0.5 transition-transform">
          →
        </span>
      </div>
      <div className="text-xl font-bold text-fg mt-xs">
        {deals.length}{" "}
        <span className="text-xs font-normal text-fg-muted">
          ({deals.length === 1 ? "Deal" : "Deals"})
        </span>
      </div>
      <div className="text-xs text-brand font-medium mt-xs truncate">
        ${totalDealAmount.toLocaleString()} total pipeline
      </div>
      {totalCameras > 0 && (
        <div
          className="text-[11px] text-fg-subtle mt-0.5 truncate"
          title={`${totalCameras.toLocaleString()} cameras across ${scopedDeals} scoped deal${scopedDeals === 1 ? "" : "s"}`}
        >
          {totalCameras.toLocaleString()} camera
          {totalCameras === 1 ? "" : "s"}
          {scopedDeals < deals.length &&
            ` · ${deals.length - scopedDeals} unscoped`}
        </div>
      )}
    </div>

    {/* Active Leads Metric Card */}
    <div
      onClick={() => setActiveTab("pipeline")}
      className="p-md rounded-xl border border-line bg-surface hover:border-brand/40 transition-all cursor-pointer shadow-xs group"
    >
      <div className="flex items-center justify-between text-xs text-fg-muted">
        <span className="font-medium">Active Leads</span>
        <span className="text-brand font-semibold group-hover:translate-x-0.5 transition-transform">
          →
        </span>
      </div>
      <div className="text-xl font-bold text-fg mt-xs">
        {leads.length}{" "}
        <span className="text-xs font-normal text-fg-muted">
          ({leads.length === 1 ? "Lead" : "Leads"})
        </span>
      </div>
      <div className="text-xs text-amber-500 font-medium mt-xs truncate">
        {totalLeadEstimate > 0
          ? `$${totalLeadEstimate.toLocaleString()} est.`
          : "Top of funnel"}
      </div>
    </div>



    {/* Commercial Documents Metric Card */}
    <div
      onClick={() => setActiveTab("financials")}
      className="p-md rounded-xl border border-line bg-surface hover:border-brand/40 transition-all cursor-pointer shadow-xs group"
    >
      <div className="flex items-center justify-between text-xs text-fg-muted">
        <span className="font-medium">Financials</span>
        <span className="text-brand font-semibold group-hover:translate-x-0.5 transition-transform">
          →
        </span>
      </div>
      <div className="text-xl font-bold text-fg mt-xs">
        {quotes.length + invoices.length}{" "}
        <span className="text-xs font-normal text-fg-muted">Docs</span>
      </div>
      <div className="text-xs text-emerald-500 font-medium mt-xs truncate">
        {quotes.length} Quotes · {invoices.length} Invoices
      </div>
    </div>
  </div>
  );
}
