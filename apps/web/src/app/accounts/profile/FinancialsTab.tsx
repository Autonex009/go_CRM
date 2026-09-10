import { useNavigate } from "react-router-dom";

import { formatMoney } from "../../lib/money";
import { Button, Card, CardHeader } from "../../ui";
import type { LinkedInvoice, LinkedQuote } from "../api";
import { RecordTable, TotalsRow } from "./RecordTable";
import { StatTile } from "./StatTile";
import { invoiceColumns, quoteColumns } from "./columns";
import type { ProfileMetrics } from "./metrics";

/**
 * The Financials tab: the quotes and invoices raised against this company.
 *
 * The three tiles are the answer to "what does this account owe us"; the tables
 * below are the working. Both read from the same metrics object the rest of the
 * profile uses, so the summary and the rows always add up.
 *
 * Read-only: a document is amended on its own page, and a row here links out to
 * it rather than opening an editor.
 */
export function FinancialsTab({
  quotes,
  invoices,
  metrics: m,
  currency,
}: {
  quotes: LinkedQuote[];
  invoices: LinkedInvoice[];
  metrics: ProfileMetrics;
  currency: string;
}) {
  const navigate = useNavigate();
  const collected = m.invoiced > 0 ? Math.round((m.paid / m.invoiced) * 100) : 0;

  return (
    <div className="mt-md flex flex-col gap-lg">
      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <StatTile
          icon="mail"
          label="Quoted"
          value={formatMoney(m.quoteValue, currency)}
          hint={`${m.quoteCount} ${m.quoteCount === 1 ? "quote" : "quotes"} raised`}
        />
        <StatTile
          icon="check"
          label="Collected"
          value={formatMoney(m.paid, currency)}
          hint={`${collected}% of ${formatMoney(m.invoiced, currency)} invoiced`}
          tone="success"
        />
        <StatTile
          icon="trend"
          label="Outstanding"
          value={formatMoney(m.outstanding, currency)}
          hint={
            m.outstanding > 0
              ? `across ${invoices.filter((i) => i.amountDue > 0).length} open ${invoices.filter((i) => i.amountDue > 0).length === 1 ? "invoice" : "invoices"}`
              : "Nothing outstanding"
          }
          tone={m.outstanding > 0 ? "warning" : "success"}
        />
      </div>

      <Card>
        <CardHeader
          title={`Quotes & proposals (${quotes.length})`}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/quotes")}
            >
              Open quotes
            </Button>
          }
          className="mb-md"
        />
        <RecordTable
          columns={quoteColumns(currency)}
          rows={quotes}
          rowKey={(q) => q.id}
          minWidth={640}
          empty={{
            icon: "mail",
            title: "No quotes raised",
            description:
              "A quote generated from one of this company's deals will be listed here.",
          }}
          footer={
            <TotalsRow
              cells={[
                { key: "number", value: "Total quoted" },
                { key: "status", value: "" },
                { key: "valid", value: "", align: "right", secondary: true },
                {
                  key: "total",
                  value: formatMoney(m.quoteValue, currency),
                  align: "right",
                },
              ]}
            />
          }
        />
      </Card>

      <Card>
        <CardHeader
          title={`Invoices & billing (${invoices.length})`}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/invoices")}
            >
              Open invoices
            </Button>
          }
          className="mb-md"
        />
        <RecordTable
          columns={invoiceColumns(currency)}
          rows={invoices}
          rowKey={(i) => i.id}
          minWidth={780}
          empty={{
            icon: "trend",
            title: "No invoices raised",
            description:
              "Invoices issued against this company appear here with what is still due.",
          }}
          footer={
            <TotalsRow
              cells={[
                { key: "number", value: "Totals" },
                { key: "status", value: "" },
                { key: "due", value: "", align: "right", secondary: true },
                {
                  key: "paid",
                  value: formatMoney(m.paid, currency),
                  align: "right",
                  secondary: true,
                },
                {
                  key: "outstanding",
                  value: formatMoney(m.outstanding, currency),
                  align: "right",
                },
                {
                  key: "total",
                  value: formatMoney(m.invoiced, currency),
                  align: "right",
                },
              ]}
            />
          }
        />
      </Card>
    </div>
  );
}
