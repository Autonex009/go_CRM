import { MessageSquare } from "lucide-react";

import type { LinkedDeal, LinkedLead } from "../api";
import { DeploymentSummary } from "../../deals/DeploymentSummary";
import { getStageMeta, stageLabel } from "../../deals/stages";
import { Badge, Button, Card, CardHeader } from "../../ui";
import type { ProfileTab } from "./tabs";

/**
 * Side-by-side previews of the company's deals and leads.
 *
 * Deliberately a preview: a handful of rows and a link into the full tab. The
 * Overview tab is meant to answer "what is going on with this company" at a
 * glance, not to be a second deals table.
 */
export function SnapshotCards({
  deals,
  leads,
  setActiveTab,
  onEditDeal,
}: {
  deals: LinkedDeal[];
  leads: LinkedLead[];
  setActiveTab: (tab: ProfileTab) => void;
  onEditDeal: (deal: LinkedDeal) => void;
}) {
  return (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
    {/* Deals Preview Card */}
    <Card>
      <CardHeader
        title={`Active Deals (${deals.length})`}
        action={
          deals.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setActiveTab("pipeline")}
            >
              View All →
            </Button>
          )
        }
        className="mb-md"
      />
      {deals.length > 0 ? (
        <div className="flex flex-col gap-sm">
          {deals.slice(0, 3).map((deal) => {
            const meta = getStageMeta(deal.stage);
            return (
              <div
                key={deal.id}
                className="p-sm rounded-lg border border-line bg-surface-muted/50 hover:bg-surface-muted transition-colors flex flex-col gap-xs cursor-pointer"
                onClick={() => onEditDeal(deal)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-fg truncate hover:text-brand transition-colors">
                    {deal.title}
                  </span>
                  <span className="font-semibold text-sm text-fg ml-sm shrink-0">
                    ${deal.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-fg-muted">
                  <Badge tone={meta.tone} dot>
                    {stageLabel(deal.stage)}
                  </Badge>
                  {deal.expectedCloseDate && (
                    <span className="text-[11px] text-fg-subtle">
                      Close: {deal.expectedCloseDate}
                    </span>
                  )}
                </div>
                <DeploymentSummary
                  compact
                  totalCameras={deal.totalCameras}
                  location={deal.location}
                  products={deal.products}
                />
                {deal.remark && (
                  <div className="mt-xs flex items-start gap-xs text-[11px] text-fg-subtle bg-surface/80 rounded p-1.5 border border-line/50 italic">
                    <MessageSquare className="h-3 w-3 text-brand shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{deal.remark}</span>
                  </div>
                )}
              </div>
            );
          })}
          {deals.length > 3 && (
            <button
              onClick={() => setActiveTab("pipeline")}
              className="text-xs text-brand font-medium hover:underline text-center py-xs"
            >
              + {deals.length - 3} more deals in Pipeline →
            </button>
          )}
        </div>
      ) : (
        <div className="p-md text-center rounded-lg border border-dashed border-line bg-surface-muted/30">
          <p className="text-xs text-fg-muted">
            No active deals yet. Deals are created on the Deals board.
          </p>
        </div>
      )}
    </Card>

    {/* Leads Preview Card */}
    <Card>
      <CardHeader
        title={`Active Leads (${leads.length})`}
        action={
          <div className="flex items-center gap-xs">
            {leads.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveTab("pipeline")}
              >
                View All →
              </Button>
            )}
          </div>
        }
        className="mb-md"
      />
      {leads.length > 0 ? (
        <div className="flex flex-col gap-sm">
          {leads.slice(0, 3).map((lead) => (
            <div
              key={lead.id}
              className="p-sm rounded-lg border border-line bg-surface-muted/50 hover:bg-surface-muted transition-colors flex flex-col gap-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-fg truncate">
                  {lead.firstName} {lead.lastName || ""}
                </span>
                {lead.value ? (
                  <span className="font-semibold text-xs text-amber-500 ml-sm shrink-0">
                    ${lead.value.toLocaleString()}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <Badge tone="brand">{lead.stage}</Badge>
                {lead.title && (
                  <span className="text-[11px] text-fg-subtle truncate max-w-[150px]">
                    {lead.title}
                  </span>
                )}
              </div>
              {(lead.email || lead.phone) && (
                <div className="text-[11px] text-fg-subtle truncate flex items-center gap-sm mt-xs">
                  {lead.email && <span>{lead.email}</span>}
                  {lead.phone && <span>• {lead.phone}</span>}
                </div>
              )}
            </div>
          ))}
          {leads.length > 3 && (
            <button
              onClick={() => setActiveTab("pipeline")}
              className="text-xs text-brand font-medium hover:underline text-center py-xs"
            >
              + {leads.length - 3} more leads in Pipeline →
            </button>
          )}
        </div>
      ) : (
        <div className="p-md text-center rounded-lg border border-dashed border-line bg-surface-muted/30">
          <p className="text-xs text-fg-muted">
            No leads currently linked. Leads are created on the Leads
            page.
          </p>
        </div>
      )}
    </Card>
  </div>
  );
}
