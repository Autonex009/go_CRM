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

export interface PlantLocation {
  name: string;
  city: string;
  address?: string;
  spocName?: string;
  spocPhone?: string;
}

export interface HardwareSpecs {
  edgeProcessor?: string;
  cameraCount?: number;
  speakerCount?: number;
  nvrMake?: string;
}

export interface CustomSection {
  title: string;
  content: string;
}

export interface CompanyProfile {
  companyId: string;
  tagline: string | null;
  description: string | null;
  primaryColor: string;
  bannerUrl: string | null;
  plantLocations: PlantLocation[];
  aiDetections: string[];
  hardwareSpecs: HardwareSpecs;
  amcStatus: "active" | "pending_renewal" | "expired" | "none";
  amcStartDate: string | null;
  amcEndDate: string | null;
  amcValue: number;
  customSections: CustomSection[];
  createdAt: string;
  updatedAt: string;
}

export interface LinkedDeal {
  id: string;
  title: string;
  stage: string;
  amount: number;
  probability: number | null;
  siteAssessmentDate: string | null;
  siteAssessmentLocation: string | null;
  expectedCloseDate: string | null;
  createdAt: string;
}

export interface LinkedQuote {
  id: string;
  number: string | null;
  status: string;
  total: number;
  currency: string;
  currentVersion: number;
  validUntil: string | null;
  createdAt: string;
}

export interface LinkedInvoice {
  id: string;
  invoiceNumber: string | null;
  title: string | null;
  status: string;
  total: number;
  amountDue: number;
  amountPaid: number;
  dueDate: string | null;
  createdAt: string;
}

export interface LinkedContact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
}

export interface FullCompanyProfilePayload {
  account: Account;
  profile: CompanyProfile;
  deals: LinkedDeal[];
  quotes: LinkedQuote[];
  invoices: LinkedInvoice[];
  contacts: LinkedContact[];
}

export interface ProfileInput {
  name: string;
  website?: string | null;
  industry?: string | null;
  phone?: string | null;
  notes?: string | null;
  ownerUserId?: string | null;
  tagline?: string | null;
  description?: string | null;
  primaryColor?: string | null;
  bannerUrl?: string | null;
  plantLocations?: PlantLocation[];
  aiDetections?: string[];
  hardwareSpecs?: HardwareSpecs;
  amcStatus?: string | null;
  amcStartDate?: string | null;
  amcEndDate?: string | null;
  amcValue?: number | null;
  customSections?: CustomSection[];
}

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

  getProfile: (id: string) => apiFetch<FullCompanyProfilePayload>(`${BASE}/${id}/profile`),

  updateProfile: (id: string, payload: ProfileInput) =>
    apiFetch<FullCompanyProfilePayload>(`${BASE}/${id}/profile`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
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
  const text = (v?: string | null) => {
    const t = v?.trim();
    return t ? t : undefined;
  };
  return {
    name: values.name.trim(),
    website: text(values.website),
    industry: text(values.industry),
    phone: text(values.phone),
    notes: text(values.notes),
    ownerUserId: text(values.ownerUserId ?? values.ownerId),
  };
}

/** Hostname without scheme or trailing slash, for display. */
export function websiteLabel(website: string | null): string | null {
  if (!website) return null;
  return website.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
