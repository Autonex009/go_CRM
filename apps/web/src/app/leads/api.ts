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
};
