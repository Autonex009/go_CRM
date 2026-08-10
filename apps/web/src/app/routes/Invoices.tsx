import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  INVOICE_STATUSES,
  invoicesApi,
  PAGE_SIZE,
  STATUS_META,
  statusBadge,
  type Invoice,
} from "../invoices/api";
import { ApiError } from "../lib/api";
import { formatMoneyExact } from "../lib/money";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  Skeleton,
  buttonClass,
} from "../ui";

/** "overdue" is a derived view, not a stored status — hence its own chip. */
const FILTERS = ["", ...INVOICE_STATUSES, "overdue"] as const;

function filterLabel(value: string): string {
  if (value === "") return "All";
  if (value === "overdue") return "Overdue";
  return STATUS_META[value as keyof typeof STATUS_META].label;
}

export default function Invoices() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<string>("");

  const query = useQuery({
    queryKey: ["invoices", offset, status],
    queryFn: () => invoicesApi.list(offset, status),
    placeholderData: keepPreviousData,
  });

  const page = query.data;
  const total = page?.total ?? 0;
  const showing = page?.items.length ?? 0;

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title="Invoices"
        subtitle={total === 0 ? "No invoices yet" : `${total} invoice${total === 1 ? "" : "s"}`}
        action={
          <Link to="/invoices/new" className={buttonClass({})}>
            <Icon name="plus" size={16} />
            New invoice
          </Link>
        }
      />

      <div className="flex flex-wrap gap-xs">
        {FILTERS.map((f) => (
          <button
            key={f || "all"}
            type="button"
            onClick={() => {
              setStatus(f);
              setOffset(0);
            }}
            className={`rounded-full px-md py-xs text-xs font-medium transition-colors duration-100 ${
              status === f
                ? "bg-accent text-white"
                : "bg-surface-muted text-fg-muted hover:bg-surface-hover hover:text-fg"
            }`}
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>

      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load invoices"}
        </Alert>
      )}

      {query.isPending ? (
        <Card padded={false} className="p-md">
          <div className="flex flex-col gap-sm">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[44px] w-full" />
            ))}
          </div>
        </Card>
      ) : showing === 0 ? (
        <EmptyState
          icon="building"
          title={status ? `No ${filterLabel(status).toLowerCase()} invoices` : "No invoices yet"}
          description="Raise one from an accepted quote, or create a standalone invoice."
          action={
            <Link to="/invoices/new" className={buttonClass({ size: "sm" })}>
              <Icon name="plus" size={14} />
              New invoice
            </Link>
          }
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-lg py-sm font-medium">Number</th>
                  <th className="px-lg py-sm font-medium">For</th>
                  <th className="px-lg py-sm font-medium">Due</th>
                  <th className="px-lg py-sm font-medium">Status</th>
                  <th className="px-lg py-sm text-right font-medium">Total</th>
                  <th className="px-lg py-sm text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {page!.items.map((invoice) => (
                  <Row
                    key={invoice.id}
                    invoice={invoice}
                    onOpen={() => navigate(`/invoices/${invoice.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between">
          <span className="text-xs tabular-nums text-fg-muted">
            {offset + 1}–{offset + showing} of {total}
          </span>
          <div className="flex gap-sm">
            <Button
              variant="secondary"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={offset + showing >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </section>
  );
}

function Row({ invoice, onOpen }: { invoice: Invoice; onOpen: () => void }) {
  const badge = statusBadge(invoice);
  const forWhom = invoice.accountName ?? invoice.contactName ?? "—";

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-line transition-colors duration-100 last:border-0 hover:bg-surface-hover"
    >
      <td className="px-lg py-sm">
        <span className="block font-medium tabular-nums text-fg">{invoice.number}</span>
        <span className="block text-xs text-fg-muted">
          {invoice.quoteNumber
            ? `from ${invoice.quoteNumber}`
            : invoice.title || `${invoice.itemCount} line${invoice.itemCount === 1 ? "" : "s"}`}
        </span>
      </td>
      <td className="px-lg py-sm text-fg-muted">{forWhom}</td>
      <td className="px-lg py-sm text-fg-muted">
        {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}
      </td>
      <td className="px-lg py-sm">
        <Badge tone={badge.tone} dot>
          {badge.label}
        </Badge>
      </td>
      <td className="px-lg py-sm text-right tabular-nums text-fg-muted">
        {formatMoneyExact(invoice.total, invoice.currency)}
      </td>
      <td className="px-lg py-sm text-right font-medium tabular-nums text-fg">
        {invoice.balance > 0 ? formatMoneyExact(invoice.balance, invoice.currency) : "—"}
      </td>
    </tr>
  );
}
