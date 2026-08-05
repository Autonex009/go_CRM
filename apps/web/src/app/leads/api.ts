import { apiFetch } from "../lib/api";
import type { LeadStage } from "./stages";

/** Mirrors leads.Lead (services/internal/leads/store.go). */
export interface Lead {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  notes: string | null;
  value: number | null;
  stage: LeadStage;
  ownerUserId: string | null;
  /** Denormalized by the server's LEFT JOIN so a card needs no lookup. */
  ownerName: string | null;
  ownerEmail: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  /** Set once the lead has produced a deal; blocks converting twice. */
  convertedAt: string | null;
  convertedDealId: string | null;
  convertedContactId: string | null;
}

/** Optional overrides for a conversion; defaults come from the lead. */
export interface ConvertInput {
  dealTitle?: string;
  amount?: number;
  dealStage?: string;
  expectedCloseDate?: string;
}

/** Mirrors leads.Conversion — what the conversion produced. */
export interface Conversion {
  leadId: string;
  contactId: string;
  dealId: string;
  /** False when an existing contact with the lead's email was reused. */
  contactCreated: boolean;
}

/** Mirrors leads.Board — the pipeline plus the stage order to render. */
export interface Board {
  stages: LeadStage[];
  leads: Lead[];
}

/** Mirrors leads.Input — the writable shape. */
export interface LeadInput {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  notes?: string;
  value?: number;
  stage: LeadStage;
  ownerUserId?: string;
}

const BASE = "/api/v1/leads";

export const leadsApi = {
  board: () => apiFetch<Board>(BASE),

  create: (input: LeadInput) =>
    apiFetch<Lead>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: LeadInput) =>
    apiFetch<Lead>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),

  /**
   * Commit a drag-and-drop. `index` is the target position within `stage`;
   * the server renumbers that column so ordering stays exact.
   */
  move: (id: string, stage: LeadStage, index: number) =>
    apiFetch<Lead>(`${BASE}/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ stage, index }),
    }),

  /**
   * Turn the lead into a contact + deal and mark it won. Server-side this is one
   * transaction; a second call returns 409.
   */
  convert: (id: string, input: ConvertInput = {}) =>
    apiFetch<Conversion>(`${BASE}/${id}/convert`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
