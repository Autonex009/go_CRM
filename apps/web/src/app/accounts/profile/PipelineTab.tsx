import { useNavigate } from "react-router-dom";

import { formatMoney } from "../../lib/money";
import { Button, Card, CardHeader } from "../../ui";
import type { LinkedDeal, LinkedLead } from "../api";
import { RecordTable, TotalsRow } from "./RecordTable";
import { StageBar } from "./StageBar";
import { dealColumns, leadColumns } from "./columns";
import type { ProfileMetrics } from "./metrics";

/**
 * The Pipeline & Deals tab: every deal on the company, and the leads still
 * feeding them.
 *
 * Read-only. Deals and leads are authored on their own pages; this tab reports
 * on them, and the buttons in each header go there rather than opening an editor
 * on top of a report.
 */
export function PipelineTab({
  deals,
  leads,
  metrics: m,
  currency,
}: {
  deals: LinkedDeal[];
  leads: LinkedLead[];
  metrics: ProfileMetrics;
  currency: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="mt-md flex flex-col gap-lg">
      <Card>
        <CardHeader
          title="Pipeline distribution"
          subtitle={`${m.dealCount} ${m.dealCount === 1 ? "deal" : "deals"} · ${formatMoney(m.dealValue, currency)} across all stages · ${formatMoney(m.weightedOpenValue, currency)} weighted forecast`}
          className="mb-md"
        />
        {m.stages.length > 0 ? (
          <StageBar stages={m.stages} currency={currency} />
        ) : (
          <p className="text-xs text-fg-subtle">
            Nothing in the pipeline for this company yet.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader
          title={`Deals (${deals.length})`}
          subtitle={`${m.openCount} open · ${m.wonCount} won`}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/deals")}
            >
              Open deals board
            </Button>
          }
          className="mb-md"
        />
        <RecordTable
          columns={dealColumns(currency)}
          rows={deals}
          rowKey={(d) => d.id}
          minWidth={860}
          empty={{
            icon: "deals",
            title: "No deals on this company",
            description:
              "Deals are created on the deals board and appear here once they are linked to this company.",
          }}
          footer={
            <TotalsRow
              cells={[
                { key: "title", value: "Total" },
                { key: "stage", value: "" },
                {
                  key: "amount",
                  value: formatMoney(m.dealValue, currency),
                  align: "right",
                },
                {
                  key: "confidence",
                  value: "",
                  align: "right",
                  secondary: true,
                },
                {
                  key: "scope",
                  value:
                    m.totalCameras > 0
                      ? `${m.totalCameras.toLocaleString()} cameras`
                      : "",
                  secondary: true,
                },
                { key: "close", value: "", align: "right", secondary: true },
              ]}
            />
          }
        />
      </Card>

      <Card>
        <CardHeader
          title={`Leads feeding this account (${leads.length})`}
          subtitle={
            m.leadEstimate > 0
              ? `${formatMoney(m.leadEstimate, currency)} estimated`
              : undefined
          }
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/leads")}
            >
              Open leads page
            </Button>
          }
          className="mb-md"
        />
        <RecordTable
          columns={leadColumns(currency)}
          rows={leads}
          rowKey={(l) => l.id}
          minWidth={720}
          empty={{
            icon: "leads",
            title: "No leads linked",
            description:
              "Leads are created on the leads page and appear here once they name this company.",
          }}
        />
      </Card>
    </div>
  );
}
