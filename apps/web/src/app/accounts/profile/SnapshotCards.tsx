import { Button, Card, CardHeader } from "../../ui";
import { formatMoney } from "../../lib/money";
import type { LinkedDeal, LinkedLead } from "../api";
import { RecordTable } from "./RecordTable";
import { compactDealColumns, leadColumns } from "./columns";
import type { ProfileTab } from "./tabs";

/** How many rows a preview shows before it defers to the full tab. */
const PREVIEW = 5;

/**
 * Previews of the company's deals and leads, side by side on the Overview.
 *
 * Deliberately a preview: the highest-value rows and a link into the full tab.
 * The Overview answers "what is going on with this company" at a glance; the
 * Pipeline tab is where the whole list lives.
 */
export function SnapshotCards({
  deals,
  leads,
  currency,
  setActiveTab,
}: {
  deals: LinkedDeal[];
  leads: LinkedLead[];
  currency: string;
  setActiveTab: (tab: ProfileTab) => void;
}) {
  // Sorted by value, not by date: a preview of five rows should show the five
  // that matter, and the newest deal is often the smallest.
  const topDeals = [...deals]
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, PREVIEW);
  const topLeads = [...leads]
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, PREVIEW);

  return (
    <div className="grid grid-cols-1 gap-lg xl:grid-cols-2">
      <Card>
        <CardHeader
          title={`Largest deals (${deals.length})`}
          subtitle={
            deals.length > 0
              ? `${formatMoney(
                  deals.reduce((sum, d) => sum + (d.amount || 0), 0),
                  currency,
                )} across all stages`
              : undefined
          }
          action={
            deals.length > PREVIEW && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveTab("pipeline")}
              >
                View all
              </Button>
            )
          }
          className="mb-md"
        />
        <RecordTable
          columns={compactDealColumns(currency)}
          rows={topDeals}
          rowKey={(d) => d.id}
          minWidth={480}
          empty={{
            icon: "deals",
            title: "No deals yet",
            description: "Deals created on the deals board show up here.",
          }}
        />
        {deals.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setActiveTab("pipeline")}
            className="mt-sm w-full text-center text-xs font-medium text-accent hover:underline"
          >
            {deals.length - PREVIEW} more in Pipeline
          </button>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`Leads (${leads.length})`}
          subtitle={
            leads.length > 0
              ? `${formatMoney(
                  leads.reduce((sum, l) => sum + (l.value || 0), 0),
                  currency,
                )} estimated`
              : undefined
          }
          action={
            leads.length > PREVIEW && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveTab("leads")}
              >
                View all
              </Button>
            )
          }
          className="mb-md"
        />
        <RecordTable
          columns={leadColumns(currency).filter((c) => c.key !== "created")}
          rows={topLeads}
          rowKey={(l) => l.id}
          minWidth={480}
          empty={{
            icon: "leads",
            title: "No leads linked",
            description: "Leads naming this company show up here.",
          }}
        />
        {leads.length > PREVIEW && (
          <button
            type="button"
            onClick={() => setActiveTab("leads")}
            className="mt-sm w-full text-center text-xs font-medium text-accent hover:underline"
          >
            {leads.length - PREVIEW} more in Leads
          </button>
        )}
      </Card>
    </div>
  );
}
