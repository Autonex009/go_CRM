import { apiFetch } from "../lib/api";
import type { DealStage } from "./stages";

/** Mirrors deals.Deal (services/internal/deals/store.go). */
export interface Deal {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  stage: DealStage;
  ownerUserId: string | null;
  /** Denormalized by the server's LEFT JOINs so a card needs no lookup. */
  ownerName: string | null;
  ownerEmail: string | null;
  contactId: string | null;
  contactName: string | null;
  accountId: string | null;
  expectedCloseDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors deals.Board. */
export interface Board {
  stages: DealStage[];
  deals: Deal[];
}

/** Mirrors deals.Input — the writable shape. */
export interface DealInput {
  title: string;
  description?: string;
  amount: number;
  stage: DealStage;
  ownerUserId?: string;
  contactId?: string;
  /** Date-only ISO string (YYYY-MM-DD) or omitted. */
  expectedCloseDate?: string;
}

const BASE = "/api/v1/deals";

export const dealsApi = {
  board: () => apiFetch<Board>(BASE),

  create: (input: DealInput) =>
    apiFetch<Deal>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: DealInput) =>
    apiFetch<Deal>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(input) }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),

  move: (id: string, stage: DealStage, index: number) =>
    apiFetch<Deal>(`${BASE}/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ stage, index }),
    }),
};
