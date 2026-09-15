import { apiFetch } from "../lib/api";
import type { DealStage } from "./stages";

/** Mirrors deals.Deal (services/internal/deals/store.go). */
export interface Deal {
  id: string;
  title: string;
  description: string | null;
  remark?: string | null;
  amount: number;
  stage: DealStage;
  ownerUserId: string | null;
  /** Denormalized by the server's LEFT JOINs so a card needs no lookup. */
  ownerName: string | null;
  ownerEmail: string | null;
  contactId: string | null;
  contactName: string | null;
  accountId: string | null;
  /** The client's name, so a card can fall back to it when there is no title. */
  accountName?: string | null;
  /** The lead this deal was converted from, if any. */
  leadId: string | null;
  leadName?: string | null;
  /** What is being deployed on this deal. */
  totalCameras: number | null;
  location: string | null;
  products: string | null;
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
  remark?: string;
  amount: number;
  stage: DealStage;
  ownerUserId?: string;
  contactId?: string;
  expectedCloseDate?: string;
  accountId?: string;
  leadId?: string;
  totalCameras?: number | null;
  location?: string;
  products?: string;
}

/**
 * A complete DealInput for an existing deal, with `changes` applied on top.
 *
 * The update endpoint is a full replace: every column it writes comes from the
 * payload, so a field left out is not "unchanged", it is set to NULL. Editing
 * one thing about a deal therefore means resending all of it. Saving a remark
 * used to drop the deal's cameras, location, products, lead and contact for
 * exactly this reason — build partial updates through here instead.
 */
export function toDealInput(deal: Deal, changes: Partial<DealInput> = {}): DealInput {
  return {
    title: deal.title,
    description: deal.description ?? undefined,
    remark: deal.remark ?? undefined,
    amount: deal.amount,
    stage: deal.stage,
    ownerUserId: deal.ownerUserId ?? undefined,
    contactId: deal.contactId ?? undefined,
    accountId: deal.accountId ?? undefined,
    leadId: deal.leadId ?? undefined,
    expectedCloseDate: deal.expectedCloseDate ?? undefined,
    totalCameras: deal.totalCameras,
    location: deal.location ?? undefined,
    products: deal.products ?? undefined,
    ...changes,
  };
}

const BASE = "/api/v1/deals";

export const dealsApi = {
  board: () => apiFetch<Board>(BASE),

  create: (input: DealInput) =>
    apiFetch<Deal>(BASE, { method: "POST", body: JSON.stringify(input) }),

  update: (id: string, input: DealInput) =>
    apiFetch<Deal>(`${BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),

  move: (id: string, stage: DealStage, index: number) =>
    apiFetch<Deal>(`${BASE}/${id}/move`, {
      method: "PATCH",
      body: JSON.stringify({ stage, index }),
    }),
};
