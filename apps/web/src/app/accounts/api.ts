import { accountSchema } from "@go-crm/schemas";
import { z } from "zod";

import { apiFetch } from "../lib/api";

/** Mirrors accounts.Account (services/internal/accounts/store.go). */
export interface Account {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  phone: string | null;
  notes: string | null;
  ownerUserId: string | null;
  /** Denormalized by the server's LEFT JOIN so a row needs no lookup. */
  ownerName: string | null;
  ownerEmail: string | null;
  createdAt: string;
  updatedAt: string;
  /** What hangs off this company — also what blocks deletion. */
  contactCount: number;
  dealCount: number;
}

/** Mirrors accounts.Page. */
export interface AccountPage {
  items: Account[];
  total: number;
  limit: number;
  offset: number;
}

/** Rows per page. The gateway caps `limit` at 100 regardless. */
export const PAGE_SIZE = 25;

const BASE = "/api/v1/accounts";

export const accountsApi = {
  list: (offset = 0, limit = PAGE_SIZE) =>
    apiFetch<AccountPage>(`${BASE}?limit=${limit}&offset=${offset}`),

  create: (input: AccountFormValues) =>
    apiFetch<Account>(BASE, { method: "POST", body: JSON.stringify(toPayload(input)) }),

  update: (id: string, input: AccountFormValues) =>
    apiFetch<Account>(`${BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(toPayload(input)),
    }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};

/**
 * Form contract. Reuses the shared account rules; the website is intentionally
 * *not* validated as a URL here because the server accepts a bare domain and adds
 * the scheme — rejecting "acme.com" in the form would be stricter than the API.
 */
export const accountFormSchema = accountSchema.omit({ id: true });

export type AccountFormValues = z.infer<typeof accountFormSchema>;

/** Drops empty strings so the request carries only what was filled in. */
function toPayload(values: AccountFormValues) {
  const text = (v?: string) => {
    const t = v?.trim();
    return t ? t : undefined;
  };
  return {
    name: values.name.trim(),
    website: text(values.website),
    industry: text(values.industry),
    phone: text(values.phone),
    notes: text(values.notes),
    ownerUserId: text(values.ownerUserId),
  };
}

/** Hostname without scheme or trailing slash, for display. */
export function websiteLabel(website: string | null): string | null {
  if (!website) return null;
  return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
