import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "../lib/api";
import { formatMoneyExact } from "../lib/money";
import {
  PAGE_SIZE,
  quotesApi,
  QUOTE_STATUSES,
  STATUS_META,
  type Quote,
  type QuoteStatus,
} from "../quotes/api";
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

export default function Quotes() {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<QuoteStatus | "">("");

  const query = useQuery({
    queryKey: ["quotes", offset, status],
    queryFn: () => quotesApi.list(offset, status),
    placeholderData: keepPreviousData,
  });

  const page = query.data;
  const total = page?.total ?? 0;
  const showing = page?.items.length ?? 0;

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title="Quotes"
        subtitle={total === 0 ? "No quotes yet" : `${total} quote${total === 1 ? "" : "s"}`}
        action={
          <Link to="/quotes/new" className={buttonClass({})}>
            <Icon name="plus" size={16} />
            New quote
          </Link>
        }
      />

      {/* Status filter. Server-side, so paging and counts stay consistent. */}
      <div className="flex flex-wrap gap-xs">
        <FilterChip active={status === ""} onClick={() => { setStatus(""); setOffset(0); }}>
          All
        </FilterChip>
        {QUOTE_STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={status === s}
            onClick={() => {
              setStatus(s);
              setOffset(0);
            }}
          >
            {STATUS_META[s].label}
          </FilterChip>
        ))}
      </div>

      {query.isError && (
        <Alert>
          {query.error instanceof ApiError ? query.error.message : "Could not load quotes"}
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
          title={status ? `No ${STATUS_META[status].label.toLowerCase()} quotes` : "No quotes yet"}
          description="A quote is a priced document you send to a customer — line items, discounts and tax."
          action={
            <Link to="/quotes/new" className={buttonClass({ size: "sm" })}>
              <Icon name="plus" size={14} />
              New quote
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
                  <th className="px-lg py-sm font-medium">Status</th>
                  <th className="px-lg py-sm text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {page!.items.map((quote) => (
                  <Row key={quote.id} quote={quote} onOpen={() => navigate(`/quotes/${quote.id}`)} />
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

function Row({ quote, onOpen }: { quote: Quote; onOpen: () => void }) {
  const meta = STATUS_META[quote.status];
  const forWhom = quote.accountName ?? quote.contactName ?? "—";

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-line transition-colors duration-100 last:border-0 hover:bg-surface-hover"
    >
      <td className="px-lg py-sm">
        <span className="block font-medium tabular-nums text-fg">{quote.number}</span>
        <span className="block text-xs text-fg-muted">
          {quote.title || `${quote.itemCount} line${quote.itemCount === 1 ? "" : "s"}`}
        </span>
      </td>
      <td className="px-lg py-sm text-fg-muted">{forWhom}</td>
      <td className="px-lg py-sm">
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </td>
      <td className="px-lg py-sm text-right font-medium tabular-nums text-fg">
        {formatMoneyExact(quote.total, quote.currency)}
      </td>
    </tr>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-md py-xs text-xs font-medium transition-colors duration-100 ${
        active
          ? "bg-accent text-white"
          : "bg-surface-muted text-fg-muted hover:bg-surface-hover hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
