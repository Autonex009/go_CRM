import type { DocumentItemInput } from "../documents/types";
import { apiFetch } from "../lib/api";
import type { Tone } from "../ui";

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "declined", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Mirrors quotes.Item. Every money figure except the inputs is server-derived. */
export interface QuoteItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  /** Net of discount, before tax. Computed by the database. */
  lineTotal: number;
}

/** Mirrors quotes.Quote. */
export interface Quote {
  id: string;
  number: string;
  title: string | null;
  status: QuoteStatus;
  /** Snapshot of the workspace currency when the quote was created. */
  currency: string;

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
  validUntil: string | null;

  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;

  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
  updatedAt: string;

  /** Present on GET /{id}; absent from list rows. */
  items?: QuoteItem[];
  itemCount: number;
}

export interface QuotePage {
  items: Quote[];
  total: number;
  limit: number;
  offset: number;
}

/** Mirrors quotes.ItemInput — the shared document line shape (no line total). */
export type QuoteItemInput = DocumentItemInput;

/** Mirrors quotes.Input. No number, status, currency or totals: all server-owned. */
export interface QuoteInput {
  title?: string;
  accountId?: string;
  contactId?: string;
  dealId?: string;
  ownerUserId?: string;
  notes?: string;
  validUntil?: string;
  items: QuoteItemInput[];
}

export const PAGE_SIZE = 25;

const BASE = "/api/v1/quotes";

export const quotesApi = {
  list: (offset = 0, status = "") =>
    apiFetch<QuotePage>(
      `${BASE}?limit=${PAGE_SIZE}&offset=${offset}${status ? `&status=${status}` : ""}`,
    ),

  get: (id: string) => apiFetch<Quote>(`${BASE}/${id}`),

  create: (input: QuoteInput) =>
    apiFetch<Quote>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: QuoteInput) =>
    apiFetch<Quote>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  setStatus: (id: string, status: QuoteStatus) =>
    apiFetch<Quote>(`${BASE}/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};

interface StatusMeta {
  label: string;
  tone: Tone;
}

export const STATUS_META: Record<QuoteStatus, StatusMeta> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  expired: { label: "Expired", tone: "warning" },
};

/**
 * Allowed lifecycle moves, mirroring quotes.transitions in Go. Used to decide
 * which buttons to show — the server still enforces it, this just avoids
 * offering an action that would be refused.
 */
const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["sent"],
  sent: ["accepted", "declined", "expired", "draft"],
  accepted: [],
  declined: ["draft"],
  expired: ["draft"],
};

export function nextStatuses(status: QuoteStatus): QuoteStatus[] {
  return TRANSITIONS[status] ?? [];
}

/** A quote can only be edited while it is a draft. */
export function isEditable(status: QuoteStatus): boolean {
  return status === "draft";
}
