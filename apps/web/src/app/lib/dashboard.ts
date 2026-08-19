import { apiFetch } from "./api";

/** Mirrors dashboard.StageSummary. */
export interface StageSummary {
  stage: string;
  count: number;
  value: number;
}

/** Mirrors dashboard.Pipeline — one board's totals. */
export interface Pipeline {
  total: number;
  /** Value of everything not yet won or lost. */
  open: number;
  won: number;
  stages: StageSummary[];
}

/** Mirrors dashboard.Attention — one thing going wrong, or about to. */
export interface Attention {
  kind: "lead" | "quote" | "invoice";
  id: string;
  label: string;
  detail: string;
  /** Negative is overdue, positive is upcoming — one field sorts the queue. */
  days: number;
  amount: number;
}

/** Mirrors dashboard.Recent — a flattened timeline entry. */
export interface Recent {
  kind: string;
  subject: string;
  body: string;
  actor: string;
  at: string;
}

/** Mirrors dashboard.Summary — the whole landing page in one request. */
export interface Summary {
  contacts: number;
  members: number;
  leads: Pipeline;
  deals: Pipeline;
  /** Reuses Pipeline: open = draft+sent, won = accepted value. */
  quotes: Pipeline;
  /** Billing is not a pipeline — what matters is money owed. */
  invoices: { total: number; outstanding: number; overdue: number; paid: number };
  attention: Attention[];
  recent: Recent[];
}

export const dashboardApi = {
  summary: () => apiFetch<Summary>("/api/v1/dashboard"),
};
