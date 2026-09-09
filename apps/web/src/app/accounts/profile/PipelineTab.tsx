import { Link, useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";

import type { LinkedDeal, LinkedLead } from "../api";
import { DeploymentSummary } from "../../deals/DeploymentSummary";
import { getStageMeta, stageLabel } from "../../deals/stages";
import { Badge, Button, Card, CardHeader } from "../../ui";

/**
 * The Pipeline & Deals tab: open deals and the leads still feeding them.
 *
 * The totals are passed in rather than recomputed here. They are summed from
 * the same deal list the Overview tab reports on, and two independent sums over
 * the same rows is exactly how the two tabs would come to disagree.
 */
export function PipelineTab({
  deals,
  leads,
  totalDealAmount,
  totalLeadEstimate,
  onEditDeal,
}: {
  deals: LinkedDeal[];
  leads: LinkedLead[];
  totalDealAmount: number;
  totalLeadEstimate: number;
  /** Opens the deal dialog on the page; deals are only ever edited, never created here. */
  onEditDeal: (deal: LinkedDeal) => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-lg mt-md">
      {/* Pipeline Funnel Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md p-md rounded-xl border border-line bg-surface">
        <div>
          <span className="text-xs text-fg-muted">
            Active Deals Pipeline
          </span>
          <div className="text-xl font-bold text-fg mt-0.5">
            {deals.length} Deals{" "}
            <span className="text-sm font-semibold text-brand">
              (${totalDealAmount.toLocaleString()})
            </span>
          </div>
        </div>
        <div>
          <span className="text-xs text-fg-muted">
            Active Leads Pipeline
          </span>
          <div className="text-xl font-bold text-fg mt-0.5">
            {leads.length} Leads{" "}
            <span className="text-sm font-semibold text-amber-500">
              {totalLeadEstimate > 0
                ? `($${totalLeadEstimate.toLocaleString()})`
                : ""}
            </span>
          </div>
        </div>
        <div>
          <span className="text-xs text-fg-muted">
            Total Active Records
          </span>
          <div className="text-xl font-bold text-fg mt-0.5">
            {deals.length + leads.length} Records
          </div>
        </div>
      </div>

      {/* Section 1: Active Deals */}
      <Card>
        <CardHeader
          title={`Active Deals (${deals.length})`}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/deals")}
            >
              View Deals Board
            </Button>
          }
          className="mb-md"
        />
        {deals.length > 0 ? (
          <div className="flex flex-col gap-sm">
            {deals.map((deal) => {
              const meta = getStageMeta(deal.stage);
              return (
                <div
                  key={deal.id}
                  className="p-md rounded-lg border border-line bg-surface-muted/60 hover:bg-surface-muted transition-colors text-xs flex flex-col gap-xs"
                >
                  <div className="flex justify-between items-start font-medium text-fg">
                    <div className="flex items-center gap-sm">
                      <span
                        className="text-sm font-semibold text-fg hover:text-brand transition-colors cursor-pointer"
                        onClick={() => onEditDeal(deal)}
                      >
                        {deal.title}
                      </span>
                      <Badge tone={meta.tone} dot>
                        {stageLabel(deal.stage)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-sm">
                      <span className="text-sm font-bold text-fg">
                        ${deal.amount.toLocaleString()}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditDeal(deal)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between text-fg-muted mt-xs">
                    {deal.expectedCloseDate ? (
                      <span>
                        Target Close:{" "}
                        <strong className="text-fg">
                          {deal.expectedCloseDate}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-fg-subtle">No close date</span>
                    )}
                    <span className="text-fg-subtle">
                      Created:{" "}
                      {new Date(deal.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <DeploymentSummary
                    totalCameras={deal.totalCameras}
                    location={deal.location}
                    products={deal.products}
                  />
                  {deal.remark && (
                    <div className="mt-sm flex items-start gap-sm text-xs text-fg-subtle bg-surface/90 rounded-md p-sm border border-line/60">
                      <MessageSquare className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-fg-muted">
                          Remark
                        </span>
                        <span className="text-fg mt-0.5">
                          {deal.remark}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-lg text-center rounded-lg border border-dashed border-line bg-surface-muted/30">
            <p className="text-sm text-fg-muted">
              No active deals found. Deals are created on the Deals board.
            </p>
          </div>
        )}
      </Card>

      {/* Section 2: Active Leads in Pipeline */}
      <Card>
        <CardHeader
          title={`Active Leads in Pipeline (${leads.length})`}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/leads")}
            >
              View All Leads
            </Button>
          }
          className="mb-md"
        />
        {leads.length > 0 ? (
          <div className="flex flex-col gap-sm">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="p-md rounded-lg border border-line bg-surface-muted/60 hover:bg-surface-muted transition-colors text-xs flex flex-col gap-xs"
              >
                <div className="flex justify-between items-start font-medium text-fg">
                  <div className="flex items-center gap-sm">
                    <span className="text-sm font-semibold text-fg">
                      {lead.firstName} {lead.lastName || ""}
                    </span>
                    <Badge tone="brand">{lead.stage}</Badge>
                    {lead.title && (
                      <span className="text-fg-muted">• {lead.title}</span>
                    )}
                  </div>
                  {lead.value ? (
                    <span className="text-sm font-bold text-amber-500">
                      ${lead.value.toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <div className="flex justify-between items-center text-fg-muted mt-xs">
                  <div className="flex items-center gap-md text-fg-subtle">
                    {lead.email && (
                      <span>
                        Email:{" "}
                        <strong className="text-fg">{lead.email}</strong>
                      </span>
                    )}
                    {lead.phone && (
                      <span>
                        Phone:{" "}
                        <strong className="text-fg">{lead.phone}</strong>
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/leads`}
                    className="text-brand hover:underline font-medium"
                  >
                    Manage in Leads →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-lg text-center rounded-lg border border-dashed border-line bg-surface-muted/30">
            <p className="text-sm text-fg-muted">
              No leads linked to this company yet. Leads are created on the
              Leads page.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
