import { apiFetch } from "./api";
import type { LeadStage } from "../leads/stages";

/** Mirrors dashboard.StageSummary. */
export interface StageSummary {
  stage: LeadStage;
  count: number;
  value: number;
}

/** Mirrors dashboard.Summary — the whole landing page in one request. */
export interface Summary {
  contacts: number;
  members: number;
  leads: number;
  stages: StageSummary[];
  /** Value of every lead not yet won or lost. */
  openPipeline: number;
  wonValue: number;
}

export const dashboardApi = {
  summary: () => apiFetch<Summary>("/api/v1/dashboard"),
};
