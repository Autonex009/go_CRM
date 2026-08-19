import type { DocumentItemInput } from "../documents/types";
import { apiFetch } from "../lib/api";
import type { Tone } from "../ui";

export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Mirrors invoices.Item. */
export interface InvoiceItem extends DocumentItemInput {
  id: string;
  position: number;
  lineTotal: number;
}

/** Mirrors invoices.Payment — one receipt against the invoice. */
export interface Payment {
  id: string;
  amount: number;
  paidOn: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

/** Mirrors invoices.Invoice. */
export interface Invoice {
  id: string;
  number: string;
  title: string | null;
  status: InvoiceStatus;
  currency: string;

  quoteId: string | null;
  quoteNumber: string | null;
  accountId: string | null;
  accountName: string | null;
  contactId: string | null;
  contactName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;

  notes: string | null;
  issueDate: string | null;
  dueDate: string | null;

  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  /** total − amountPaid, computed by the server. */
  balance: number;
  /** Derived from the due date, never stored. */
  overdue: boolean;

  sentAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Omitted from JSON when empty (Go `omitempty`), so always default these.
  items?: InvoiceItem[];
  payments?: Payment[];
  itemCount: number;
}

export interface InvoicePage {
  items: Invoice[];
  total: number;
  limit: number;
  offset: number;
}

/** Mirrors invoices.Input. No number, status, currency, totals or amount paid. */
export interface InvoiceInput {
  title?: string;
  accountId?: string;
  contactId?: string;
  dealId?: string;
  ownerUserId?: string;
  notes?: string;
  issueDate?: string;
  dueDate?: string;
  items: DocumentItemInput[];
}

export interface PaymentInput {
  amount: number;
  paidOn?: string;
  method?: string;
  reference?: string;
  note?: string;
}

export const PAGE_SIZE = 25;

const BASE = "/api/v1/invoices";

export const invoicesApi = {
  /** `status` also accepts the derived "overdue" view. */
  list: (offset = 0, status = "") =>
    apiFetch<InvoicePage>(
      `${BASE}?limit=${PAGE_SIZE}&offset=${offset}${status ? `&status=${status}` : ""}`,
    ),

  get: (id: string) => apiFetch<Invoice>(`${BASE}/${id}`),

  create: (input: InvoiceInput) =>
    apiFetch<Invoice>(BASE, { method: "POST", body: JSON.stringify(input) }),

  fromQuote: (quoteId: string, dueDate?: string) =>
    apiFetch<Invoice>(`${BASE}/from-quote`, {
      method: "POST",
      body: JSON.stringify({ quoteId, dueDate }),
    }),

  update: (id: string, input: InvoiceInput) =>
    apiFetch<Invoice>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  setStatus: (id: string, status: InvoiceStatus) =>
    apiFetch<Invoice>(`${BASE}/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),

  recordPayment: (id: string, input: PaymentInput) =>
    apiFetch<Invoice>(`${BASE}/${id}/payments`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};

interface StatusMeta {
  label: string;
  tone: Tone;
}

export const STATUS_META: Record<InvoiceStatus, StatusMeta> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Issued", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  void: { label: "Void", tone: "danger" },
};

/** Mirrors invoices.transitions in Go; the server still enforces it. */
const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent", "void"],
  sent: ["paid", "void"],
  paid: [],
  void: [],
};

export function nextStatuses(status: InvoiceStatus): InvoiceStatus[] {
  return TRANSITIONS[status] ?? [];
}

/** Only a draft is editable — an issued invoice is voided, not rewritten. */
export function isEditable(status: InvoiceStatus): boolean {
  return status === "draft";
}

/** Money can only be recorded against an issued invoice. */
export function canTakePayment(status: InvoiceStatus): boolean {
  return status === "sent" || status === "paid";
}

/** The badge to show: overdue outranks the plain status. */
export function statusBadge(invoice: Invoice): { label: string; tone: Tone } {
  if (invoice.overdue) return { label: "Overdue", tone: "danger" };
  return STATUS_META[invoice.status];
}
