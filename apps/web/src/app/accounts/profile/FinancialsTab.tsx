import { Link } from "react-router-dom";

import type { LinkedInvoice, LinkedQuote } from "../api";
import { Card, CardHeader } from "../../ui";

/**
 * The Financials tab: the quotes and invoices raised against this company.
 *
 * Both lists link out to the document itself rather than reproducing its
 * totals, so the money is only ever rendered from one place.
 */
export function FinancialsTab({
  quotes,
  invoices,
}: {
  quotes: LinkedQuote[];
  invoices: LinkedInvoice[];
}) {
  return (
    <div className="flex flex-col gap-lg mt-md">
      {/* Quotes & Proposals */}
      <Card>
        <CardHeader
          title={`Quotes & Proposals (${quotes.length})`}
          className="mb-md"
        />
        {quotes.length > 0 ? (
          <div className="flex flex-col gap-sm">
            {quotes.map((quote) => (
              <div
                key={quote.id}
                className="p-sm rounded-md border border-line bg-surface-muted text-xs flex justify-between items-center"
              >
                <div>
                  <span className="font-medium text-fg block">
                    {quote.number || "Quote"}
                  </span>
                  <span className="text-fg-muted">
                    Status: {quote.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-fg block">
                    ${quote.total.toLocaleString()}
                  </span>
                  <Link
                    to={`/quotes/${quote.id}/preview`}
                    className="text-brand hover:underline text-[11px]"
                  >
                    View Quote →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-fg-subtle">No quotes issued yet.</p>
        )}
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader
          title={`Invoices & Billing (${invoices.length})`}
          className="mb-md"
        />
        {invoices.length > 0 ? (
          <div className="flex flex-col gap-sm">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="p-sm rounded-md border border-line bg-surface-muted text-xs flex justify-between items-center"
              >
                <div>
                  <span className="font-medium text-fg block">
                    {inv.invoiceNumber || inv.title || "Invoice"}
                  </span>
                  <span className="text-fg-muted">
                    Status: {inv.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-fg block">
                    ${inv.total.toLocaleString()}
                  </span>
                  <Link
                    to={`/invoices/${inv.id}/preview`}
                    className="text-brand hover:underline text-[11px]"
                  >
                    View Invoice →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-fg-subtle">No invoices issued yet.</p>
        )}
      </Card>
    </div>
  );
}
