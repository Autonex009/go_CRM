import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AccountSelect } from "../accounts/AccountSelect";
import { Timeline } from "../activities/Timeline";
import { contactName, contactsApi } from "../contacts/api";
import { dealsApi } from "../deals/api";
import { invoicesApi } from "../invoices/api";
import { ApiError } from "../lib/api";
import { formatMoneyExact } from "../lib/money";
import { memberLabel, orgApi } from "../org/api";
import { useCurrency } from "../org/workspace";
import { LineItems } from "../documents/LineItems";
import { emptyDocumentItem } from "../documents/types";
import {
  isEditable,
  nextStatuses,
  quotesApi,
  STATUS_META,
  type QuoteInput,
  type QuoteItemInput,
  type QuoteStatus,
} from "../quotes/api";
import { computeTotals } from "../documents/totals";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Icon,
  PageHeader,
  SelectField,
  Skeleton,
  TextareaField,
  buttonClass,
} from "../ui";

const emptyItem = emptyDocumentItem;

interface Header {
  title: string;
  accountId: string;
  contactId: string;
  dealId: string;
  ownerUserId: string;
  validUntil: string;
  notes: string;
}

const emptyHeader = (): Header => ({
  title: "",
  accountId: "",
  contactId: "",
  dealId: "",
  ownerUserId: "",
  validUntil: "",
  notes: "",
});

/**
 * The quote document editor.
 *
 * A route rather than a modal: line items need the full width, and a document
 * you can link to and reload is worth more than one trapped in a dialog.
 */
export default function QuoteEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceCurrency = useCurrency();

  const [header, setHeader] = useState<Header>(emptyHeader);
  const [items, setItems] = useState<QuoteItemInput[]>(() => [emptyItem()]);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const query = useQuery({
    queryKey: ["quote", id],
    queryFn: () => quotesApi.get(id!),
    enabled: !isNew,
  });

  const quote = query.data;
  const status: QuoteStatus = quote?.status ?? "draft";
  const editable = isNew || isEditable(status);
  // An issued quote shows the currency it was issued in, not today's setting.
  const currency = quote?.currency ?? workspaceCurrency;

  // Hydrate the form once the document arrives. `dirty` guards against a
  // background refetch overwriting edits in progress.
  useEffect(() => {
    if (!quote || dirty) return;
    setHeader({
      title: quote.title ?? "",
      accountId: quote.accountId ?? "",
      contactId: quote.contactId ?? "",
      dealId: quote.dealId ?? "",
      ownerUserId: quote.ownerUserId ?? "",
      validUntil: quote.validUntil?.slice(0, 10) ?? "",
      notes: quote.notes ?? "",
    });
    setItems(
      quote.items?.length
        ? quote.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discountPercent: i.discountPercent,
            taxPercent: i.taxPercent,
          }))
        : [emptyItem()],
    );
  }, [quote, dirty]);

  // Pickers. All cached and shared with the other dialogs.
  const members = useQuery({ queryKey: ["members"], queryFn: orgApi.members, staleTime: 5 * 60_000 });
  const contacts = useQuery({
    queryKey: ["contacts", 0],
    queryFn: () => contactsApi.list(0),
    staleTime: 60_000,
  });
  const deals = useQuery({ queryKey: ["deals"], queryFn: dealsApi.board, staleTime: 60_000 });

  const totals = useMemo(() => computeTotals(items), [items]);

  const patchHeader = useCallback((patch: Partial<Header>) => {
    setDirty(true);
    setHeader((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchItem = useCallback((index: number, patch: Partial<QuoteItemInput>) => {
    setDirty(true);
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((index: number) => {
    setDirty(true);
    // Never leave the grid empty — an editor with no rows has no affordance.
    setItems((prev) => (prev.length === 1 ? [emptyItem()] : prev.filter((_, i) => i !== index)));
  }, []);

  const addItem = useCallback(() => {
    setDirty(true);
    setItems((prev) => [...prev, emptyItem()]);
  }, []);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["quotes"] });
    void queryClient.invalidateQueries({ queryKey: ["quote", id] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, id]);

  const toPayload = (): QuoteInput => {
    const text = (v: string) => (v.trim() ? v.trim() : undefined);
    return {
      title: text(header.title),
      accountId: text(header.accountId),
      contactId: text(header.contactId),
      dealId: text(header.dealId),
      ownerUserId: text(header.ownerUserId),
      notes: text(header.notes),
      validUntil: header.validUntil ? `${header.validUntil}T00:00:00Z` : undefined,
      // Blank trailing rows are dropped server-side too; this keeps the request tidy.
      items: items.filter((i) => i.description.trim() || i.unitPrice || i.quantity !== 1),
    };
  };

  const save = useMutation({
    mutationFn: () => (isNew ? quotesApi.create(toPayload()) : quotesApi.update(id!, toPayload())),
    onSuccess: (saved) => {
      setError(null);
      setDirty(false);
      invalidate();
      if (isNew) navigate(`/quotes/${saved.id}`, { replace: true });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save this quote"),
  });

  const transition = useMutation({
    mutationFn: (to: QuoteStatus) => quotesApi.setStatus(id!, to),
    onSuccess: () => {
      setError(null);
      setDirty(false);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not update the status"),
  });

  // An accepted quote is the hook invoices hang off (§23.3).
  const raiseInvoice = useMutation({
    mutationFn: () => invoicesApi.fromQuote(id!),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/invoices/${invoice.id}`);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not raise an invoice"),
  });

  const remove = useMutation({
    mutationFn: () => quotesApi.remove(id!),
    onSuccess: () => {
      invalidate();
      navigate("/quotes");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not delete"),
  });

  if (!isNew && query.isPending) {
    return (
      <section className="flex flex-col gap-lg">
        <Skeleton className="h-[32px] w-[220px]" />
        <Card>
          <Skeleton className="h-[180px] w-full" />
        </Card>
      </section>
    );
  }

  if (!isNew && query.isError) {
    return (
      <Alert>
        {query.error instanceof ApiError ? query.error.message : "Could not load this quote"}
      </Alert>
    );
  }

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title={isNew ? "New quote" : (quote?.number ?? "Quote")}
        subtitle={
          isNew
            ? "A number is assigned when you save."
            : quote?.title || "Untitled quote"
        }
        action={
          <div className="flex flex-wrap items-center gap-sm">
            <Link to="/quotes" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Back
            </Link>
            {!isNew && (
              <Badge tone={STATUS_META[status].tone} dot>
                {STATUS_META[status].label}
              </Badge>
            )}
            {editable && (
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : isNew ? "Create quote" : "Save"}
              </Button>
            )}
          </div>
        }
      />

      {error && <Alert>{error}</Alert>}

      {!editable && (
        <Alert tone="brand">
          This quote has been issued, so its lines are locked. Revise it back to a draft to
          make changes.
        </Alert>
      )}

      {/* Lifecycle actions, driven by the same transition table the server enforces. */}
      {!isNew && (
        <Card className="flex flex-wrap items-center gap-sm">
          <span className="text-xs font-medium text-fg-muted">Actions</span>
          {nextStatuses(status).map((next) => (
            <Button
              key={next}
              variant={next === "accepted" ? "primary" : "secondary"}
              size="sm"
              disabled={transition.isPending}
              onClick={() => transition.mutate(next)}
            >
              {next === "draft" ? "Revise (back to draft)" : `Mark ${STATUS_META[next].label}`}
            </Button>
          ))}
          {status === "accepted" && (
            <Button size="sm" disabled={raiseInvoice.isPending} onClick={() => raiseInvoice.mutate()}>
              {raiseInvoice.isPending ? "Raising…" : "Raise invoice"}
            </Button>
          )}
          {nextStatuses(status).length === 0 && (
            <span className="text-xs text-fg-muted">
              Accepted quotes are final. Raising an invoice copies these lines.
            </span>
          )}
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm("Delete this draft quote?")) remove.mutate();
              }}
            >
              <span className="text-bad-fg">Delete draft</span>
            </Button>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Details" subtitle="Who this quote is for" />
        <div className="mt-md grid gap-md sm:grid-cols-2">
          <Field
            label="Title"
            name="title"
            value={header.title}
            readOnly={!editable}
            onChange={(e) => patchHeader({ title: e.target.value })}
            placeholder="Q3 proposal"
          />
          <Field
            label="Valid until"
            name="validUntil"
            type="date"
            value={header.validUntil}
            readOnly={!editable}
            onChange={(e) => patchHeader({ validUntil: e.target.value })}
          />

          <AccountSelect
            value={header.accountId}
            disabled={!editable}
            onChange={(e) => patchHeader({ accountId: e.target.value })}
          />

          <SelectField
            label="Contact"
            name="contactId"
            value={header.contactId}
            disabled={!editable}
            onChange={(e) => patchHeader({ contactId: e.target.value })}
          >
            <option value="">—</option>
            {(contacts.data?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {contactName(c)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Deal"
            name="dealId"
            value={header.dealId}
            disabled={!editable}
            onChange={(e) => patchHeader({ dealId: e.target.value })}
          >
            <option value="">—</option>
            {(deals.data?.deals ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Owner"
            name="ownerUserId"
            value={header.ownerUserId}
            disabled={!editable}
            onChange={(e) => patchHeader({ ownerUserId: e.target.value })}
          >
            <option value="">Unassigned</option>
            {(members.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m)}
              </option>
            ))}
          </SelectField>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Line items"
          subtitle={`Amounts in ${currency}. Totals are recalculated by the server on save.`}
        />
        <div className="mt-md">
          <LineItems
            items={items}
            currency={currency}
            readOnly={!editable}
            onChange={patchItem}
            onRemove={removeItem}
          />
        </div>

        {editable && (
          <button
            type="button"
            onClick={addItem}
            className="mt-md flex items-center gap-xs rounded-md px-sm py-xs text-xs font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <Icon name="plus" size={13} />
            Add line
          </button>
        )}

        {/* Totals: a live preview that rounds exactly as the database does. */}
        <dl className="mt-lg ml-auto flex w-full max-w-[280px] flex-col gap-xs border-t border-line pt-md text-sm">
          <Row label="Subtotal" value={formatMoneyExact(totals.subtotal, currency)} />
          {totals.discountTotal > 0 && (
            <Row label="Discount" value={`− ${formatMoneyExact(totals.discountTotal, currency)}`} />
          )}
          <Row label="Tax" value={formatMoneyExact(totals.taxTotal, currency)} />
          <div className="mt-xs flex items-center justify-between border-t border-line pt-sm">
            <dt className="text-sm font-semibold text-fg">Total</dt>
            <dd className="text-base font-semibold tabular-nums text-fg">
              {formatMoneyExact(totals.total, currency)}
            </dd>
          </div>
        </dl>
      </Card>

      {!isNew && id && <Timeline scope={{ quoteId: id }} />}

      <Card>
        <TextareaField
          label="Notes"
          name="notes"
          rows={3}
          value={header.notes}
          readOnly={!editable}
          onChange={(e) => patchHeader({ notes: e.target.value })}
          placeholder="Terms, delivery, anything the customer should see."
        />
      </Card>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="tabular-nums text-fg">{value}</dd>
    </div>
  );
}
