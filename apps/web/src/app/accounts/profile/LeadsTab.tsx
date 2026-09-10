import { useNavigate } from "react-router-dom";

import { formatMoney } from "../../lib/money";
import { Button, Card, CardHeader } from "../../ui";
import type { LinkedLead } from "../api";
import { RecordTable, TotalsRow } from "./RecordTable";
import { leadColumns } from "./columns";

/**
 * The Leads tab: every lead pointing at this company.
 *
 * Read-only by design. Leads are created and edited on the leads page, so the
 * profile stays a view of what already exists rather than a second place to
 * author the same record.
 */
export function LeadsTab({
  leads,
  currency,
}: {
  leads: LinkedLead[];
  currency: string;
}) {
  const navigate = useNavigate();
  const estimate = leads.reduce((sum, l) => sum + (l.value || 0), 0);
  const withEmail = leads.filter((l) => l.email?.trim()).length;

  return (
    <div className="mt-md flex flex-col gap-lg">
      <Card>
        <CardHeader
          title={`Leads (${leads.length})`}
          subtitle={
            leads.length > 0
              ? `${withEmail} of ${leads.length} reachable by email${estimate > 0 ? ` · ${formatMoney(estimate, currency)} estimated` : ""}`
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
            title: "No leads linked to this company",
            description:
              "A lead appears here once it names this company. Leads are created and edited on the leads page.",
          }}
          footer={
            estimate > 0 ? (
              <TotalsRow
                cells={[
                  { key: "name", value: "Total estimate" },
                  { key: "stage", value: "" },
                  { key: "contact", value: "", secondary: true },
                  {
                    key: "value",
                    value: formatMoney(estimate, currency),
                    align: "right",
                  },
                  { key: "created", value: "", align: "right", secondary: true },
                ]}
              />
            ) : undefined
          }
        />
      </Card>
    </div>
  );
}
