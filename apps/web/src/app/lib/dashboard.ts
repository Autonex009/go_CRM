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
}

export const dashboardApi = {
  summary: () => apiFetch<Summary>("/api/v1/dashboard"),
};
