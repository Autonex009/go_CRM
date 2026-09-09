import { useNavigate } from "react-router-dom";

import type { LinkedLead } from "../api";
import { Button, Card, CardHeader } from "../../ui";

/**
 * The Leads tab: every lead pointing at this company.
 *
 * Read-only by design. Leads are created and edited on the Leads page, so the
 * profile stays a view of what already exists rather than a second place to
 * author the same record.
 */
export function LeadsTab({ leads }: { leads: LinkedLead[] }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-lg mt-md">
      <Card>
        <CardHeader
          title={`Leads (${leads?.length || 0})`}
          className="mb-md"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/leads")}
            >
              Open Leads Page
            </Button>
          }
        />
        {leads && leads.length > 0 ? (
          <div className="flex flex-col gap-sm">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="p-sm rounded-md border border-line bg-surface-muted text-xs flex flex-col gap-xs"
              >
                <div className="flex justify-between font-medium text-fg">
                  <span>
                    {lead.firstName} {lead.lastName || ""}
                  </span>
                  {lead.value ? (
                    <span>${lead.value.toLocaleString()}</span>
                  ) : null}
                </div>
                <div className="flex justify-between text-fg-muted">
                  <span>Stage: {lead.stage}</span>
                  {lead.title && <span>{lead.title}</span>}
                </div>
                {lead.email && (
                  <div className="text-fg-subtle truncate">
                    {lead.email}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-fg-subtle">No leads linked yet.</p>
        )}
      </Card>
    </div>
  );
}
