import { apiFetch } from "../lib/api";
import type { NewContactInput } from "./schemas";

/** Mirrors contacts.Contact (services/internal/contacts/store.go). */
export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  accountId: string | null;
  createdAt: string;
}

/** Mirrors contacts.Page — one page plus the totals the list UI needs. */
export interface ContactPage {
  items: Contact[];
  total: number;
  limit: number;
  offset: number;
}

/** Rows per page. The gateway caps `limit` at 100 regardless of what we ask. */
export const PAGE_SIZE = 25;

const BASE = "/api/v1/contacts";

export const contactsApi = {
  list: (offset = 0) =>
    apiFetch<ContactPage>(`${BASE}?limit=${PAGE_SIZE}&offset=${offset}`),

  create: (input: NewContactInput) =>
    apiFetch<Contact>(BASE, { method: "POST", body: JSON.stringify(input) }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};
