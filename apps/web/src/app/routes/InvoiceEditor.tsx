import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AccountSelect } from "../accounts/AccountSelect";
import { Timeline } from "../activities/Timeline";
import { contactName, contactsApi } from "../contacts/api";
import { dealsApi } from "../deals/api";
import { LineItems } from "../documents/LineItems";
import { computeTotals } from "../documents/totals";
import { emptyDocumentItem, type DocumentItemInput } from "../documents/types";
import { PaymentDialog } from "../invoices/PaymentDialog";
import {
  canTakePayment,
  invoicesApi,
  isEditable,
  nextStatuses,
  STATUS_META,
  type InvoiceInput,
  type InvoiceStatus,
} from "../invoices/api";
import { ApiError } from "../lib/api";
import { formatMoneyExact } from "../lib/money";
import { memberLabel, orgApi } from "../org/api";
import { useCurrency } from "../org/workspace";
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

interface Header {
  title: string;
  accountId: string;
  contactId: string;
  dealId: string;
  ownerUserId: string;
  issueDate: string;
  dueDate: string;
  notes: string;
}

const emptyHeader = (): Header => ({
  title: "",
  accountId: "",
  contactId: "",
  dealId: "",
  ownerUserId: "",
  issueDate: "",
  dueDate: "",
  notes: "",
});

/**
 * The invoice document editor. Same shape as the quote editor — a route, the
 * shared line-item grid, a live totals preview — plus the parts only a bill has:
 * a balance, a payment history, and no way back once issued.
 */
export default function InvoiceEditor() {
  const { id } = useParams();
  const isNew = !id || id === "new";

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceCurrency = useCurrency();

  const [header, setHeader] = useState<Header>(emptyHeader);
  const [items, setItems] = useState<DocumentItemInput[]>(() => [emptyDocumentItem()]);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [paying, setPaying] = useState(false);

  const query = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => invoicesApi.get(id!),
    enabled: !isNew,
  });

  const invoice = query.data;
  const status: InvoiceStatus = invoice?.status ?? "draft";
  const editable = isNew || isEditable(status);
  const currency = invoice?.currency ?? workspaceCurrency;

  useEffect(() => {
    if (!invoice || dirty) return;
    setHeader({
      title: invoice.title ?? "",
      accountId: invoice.accountId ?? "",
      contactId: invoice.contactId ?? "",
      dealId: invoice.dealId ?? "",
      ownerUserId: invoice.ownerUserId ?? "",
      issueDate: invoice.issueDate?.slice(0, 10) ?? "",
      dueDate: invoice.dueDate?.slice(0, 10) ?? "",
      notes: invoice.notes ?? "",
    });
    setItems(
      invoice.items?.length
        ? invoice.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discountPercent: i.discountPercent,
            taxPercent: i.taxPercent,
          }))
        : [emptyDocumentItem()],
    );
  }, [invoice, dirty]);

  const members = useQuery({ queryKey: ["members"], queryFn: orgApi.members, staleTime: 5 * 60_000 });
  const contacts = useQuery({
    queryKey: ["contacts", 0],
    queryFn: () => contactsApi.list(0),
    staleTime: 60_000,
  });
  const deals = useQuery({ queryKey: ["deals"], queryFn: dealsApi.board, staleTime: 60_000 });

  // Preview while editing; once issued the server's stored figures are the truth
  // (they are a record of what was billed, not a recalculation).
  const preview = useMemo(() => computeTotals(items), [items]);
  const totals = editable
    ? preview
    : {
        subtotal: invoice?.subtotal ?? 0,
        discountTotal: invoice?.discountTotal ?? 0,
        taxTotal: invoice?.taxTotal ?? 0,
        total: invoice?.total ?? 0,
      };

  const patchHeader = useCallback((patch: Partial<Header>) => {
    setDirty(true);
    setHeader((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchItem = useCallback((index: number, patch: Partial<DocumentItemInput>) => {
    setDirty(true);
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((index: number) => {
    setDirty(true);
    setItems((prev) =>
      prev.length === 1 ? [emptyDocumentItem()] : prev.filter((_, i) => i !== index),
    );
  }, []);

  const addItem = useCallback(() => {
    setDirty(true);
    setItems((prev) => [...prev, emptyDocumentItem()]);
  }, []);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    void queryClient.invalidateQueries({ queryKey: ["invoice", id] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }, [queryClient, id]);

  const toPayload = (): InvoiceInput => {
    const text = (v: string) => (v.trim() ? v.trim() : undefined);
    const date = (v: string) => (v ? `${v}T00:00:00Z` : undefined);
    return {
      title: text(header.title),
      accountId: text(header.accountId),
      contactId: text(header.contactId),
      dealId: text(header.dealId),
      ownerUserId: text(header.ownerUserId),
      notes: text(header.notes),
      issueDate: date(header.issueDate),
      dueDate: date(header.dueDate),
      items: items.filter((i) => i.description.trim() || i.unitPrice || i.quantity !== 1),
    };
  };

  const save = useMutation({
    mutationFn: () =>
      isNew ? invoicesApi.create(toPayload()) : invoicesApi.update(id!, toPayload()),
    onSuccess: (saved) => {
      setError(null);
      setDirty(false);
      invalidate();
      if (isNew) navigate(`/invoices/${saved.id}`, { replace: true });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not save this invoice"),
  });

  const transition = useMutation({
    mutationFn: (to: InvoiceStatus) => invoicesApi.setStatus(id!, to),
    onSuccess: () => {
      setError(null);
      setDirty(false);
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not update the status"),
  });

  const pay = useMutation({
    mutationFn: (input: Parameters<typeof invoicesApi.recordPayment>[1]) =>
      invoicesApi.recordPayment(id!, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => invoicesApi.remove(id!),
    onSuccess: () => {
      invalidate();
      navigate("/invoices");
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
        {query.error instanceof ApiError ? query.error.message : "Could not load this invoice"}
      </Alert>
    );
  }

  const payments = invoice?.payments ?? [];

  return (
    <section className="flex flex-col gap-lg">
      <PageHeader
        title={isNew ? "New invoice" : (invoice?.number ?? "Invoice")}
        subtitle={
          isNew ? "A number is assigned when you save." : invoice?.title || "Untitled invoice"
        }
        action={
          <div className="flex flex-wrap items-center gap-sm">
            <Link to="/invoices" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Back
            </Link>
            {!isNew && invoice && (
              <Badge tone={invoice.overdue ? "danger" : STATUS_META[status].tone} dot>
                {invoice.overdue ? "Overdue" : STATUS_META[status].label}
              </Badge>
            )}
            {editable && (
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving…" : isNew ? "Create invoice" : "Save"}
              </Button>
            )}
          </div>
        }
      />

      {error && <Alert>{error}</Alert>}

      {!editable && (
        <Alert tone="brand">
          This invoice has been issued, so its lines are locked. Corrections are made by
          voiding it and raising a new one.
        </Alert>
      )}

      {invoice?.quoteNumber && (
        <p className="text-xs text-fg-muted">
          Raised from quote{" "}
          <Link to={`/quotes/${invoice.quoteId}`} className="font-medium text-accent">
            {invoice.quoteNumber}
          </Link>
        </p>
      )}

      {!isNew && invoice && (
        <Card className="flex flex-wrap items-center gap-sm">
          <span className="text-xs font-medium text-fg-muted">Actions</span>
          {nextStatuses(status).map((next) => (
            <Button
              key={next}
              variant={next === "void" ? "secondary" : "primary"}
              size="sm"
              disabled={transition.isPending}
              onClick={() => {
                if (next === "void" && !window.confirm("Void this invoice? This cannot be undone."))
                  return;
                transition.mutate(next);
              }}
            >
              {next === "sent" ? "Issue invoice" : `Mark ${STATUS_META[next].label}`}
            </Button>
          ))}

          {canTakePayment(status) && invoice.balance > 0 && (
            <Button size="sm" onClick={() => setPaying(true)}>
              Record payment
            </Button>
          )}
          {nextStatuses(status).length === 0 && invoice.balance <= 0 && (
            <span className="text-xs text-fg-muted">
              {status === "paid" ? "Settled in full." : "This invoice is closed."}
            </span>
          )}

          {editable && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm("Delete this draft invoice?")) remove.mutate();
              }}
            >
              <span className="text-bad-fg">Delete draft</span>
            </Button>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Details" subtitle="Who this invoice is for, and when it falls due" />
        <div className="mt-md grid gap-md sm:grid-cols-2">
          <Field
            label="Title"
            name="title"
            value={header.title}
            readOnly={!editable}
            onChange={(e) => patchHeader({ title: e.target.value })}
            placeholder="March services"
          />
          <AccountSelect
            value={header.accountId}
            disabled={!editable}
            onChange={(e) => patchHeader({ accountId: e.target.value })}
          />

          <Field
            label="Issue date"
            name="issueDate"
            type="date"
            value={header.issueDate}
            readOnly={!editable}
            onChange={(e) => patchHeader({ issueDate: e.target.value })}
          />
          <Field
            label="Due date"
            name="dueDate"
            type="date"
            value={header.dueDate}
            readOnly={!editable}
            onChange={(e) => patchHeader({ dueDate: e.target.value })}
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

        <dl className="mt-lg ml-auto flex w-full max-w-[300px] flex-col gap-xs border-t border-line pt-md text-sm">
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

          {invoice && invoice.amountPaid > 0 && (
            <>
              <Row label="Paid" value={`− ${formatMoneyExact(invoice.amountPaid, currency)}`} />
              <div className="flex items-center justify-between border-t border-line pt-sm">
                <dt className="text-sm font-semibold text-fg">Balance</dt>
                <dd
                  className={`text-base font-semibold tabular-nums ${
                    invoice.balance > 0 ? "text-fg" : "text-ok-fg"
                  }`}
                >
                  {formatMoneyExact(invoice.balance, currency)}
                </dd>
              </div>
            </>
          )}
        </dl>
      </Card>

      {payments.length > 0 && (
        <Card padded={false}>
          <div className="px-lg py-md">
            <CardHeader title="Payments" subtitle={`${payments.length} recorded`} />
          </div>
          <ul className="border-t border-line">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-md border-b border-line px-lg py-sm last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-fg">
                    {new Date(p.paidOn).toLocaleDateString()}
                    {p.method ? ` · ${p.method}` : ""}
                  </p>
                  {(p.reference || p.note) && (
                    <p className="truncate text-xs text-fg-muted">
                      {[p.reference, p.note].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ok-fg">
                  {formatMoneyExact(p.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!isNew && id && <Timeline scope={{ invoiceId: id }} />}

      <Card>
        <TextareaField
          label="Notes"
          name="notes"
          rows={3}
          value={header.notes}
          readOnly={!editable}
          onChange={(e) => patchHeader({ notes: e.target.value })}
          placeholder="Payment terms, bank details, anything the customer should see."
        />
      </Card>

      {paying && invoice && (
        <PaymentDialog
          invoice={invoice}
          onClose={() => setPaying(false)}
          onSubmit={(input) => pay.mutateAsync(input)}
        />
      )}
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
