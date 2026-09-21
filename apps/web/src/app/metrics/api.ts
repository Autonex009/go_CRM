import type { DealStage } from "../deals/stages";
import { apiFetch } from "../lib/api";

/** Mirrors metrics.StageRow (services/internal/metrics/report.go). */
export interface StageRow {
  stage: DealStage;
  count: number;
  value: number;
  cameras: number;
}

/** Mirrors metrics.OwnerRow — one salesperson's contribution. */
export interface OwnerRow {
  ownerId: string;
  name: string;
  openCount: number;
  openValue: number;
  wonCount: number;
  wonValue: number;
  cameras: number;
}

/** Mirrors metrics.MonthRow. `month` is the first day, as YYYY-MM-DD. */
export interface MonthRow {
  month: string;
  created: number;
  won: number;
  wonValue: number;
  cameras: number;
}

/** Mirrors metrics.StalledRow — an open deal nobody has touched lately. */
export interface StalledRow {
  dealId: string;
  title: string;
  accountName: string;
  stage: DealStage;
  amount: number;
  cameras: number;
  ownerName: string;
  updatedAt: string;
  idleDays: number;
}

/**
 * How much of the pipeline carries the fields the money figures come from.
 *
 * The page reads this before it trusts a total: most deals in this workspace
 * were filed without an amount, and a confident ₹0 on the funnel would be read
 * as "we have quoted nothing" rather than "nobody typed the number in".
 */
export interface Coverage {
  deals: number;
  priced: number;
  withCameras: number;
}

/** Mirrors metrics.Totals — the headline row. */
export interface Totals {
  deals: number;
  openCount: number;
  openValue: number;
  wonCount: number;
  wonValue: number;
  quotedValue: number;
  totalCameras: number;
  openCameras: number;
  wonCameras: number;
  avgDealSize: number;
  valuePerCamera: number;
  /** Won over total, as a percentage. Not a win rate — this board has no lost
   *  stage, so nothing here counts a loss. */
  conversionRate: number;
}

/** Mirrors metrics.Report — the whole page in one response. */
export interface Report {
  generatedAt: string;
  stages: StageRow[];
  totals: Totals;
  owners: OwnerRow[];
  months: MonthRow[];
  stalled: StalledRow[];
  coverage: Coverage;
}

export interface MetricsFilter {
  /** ISO 8601. Both ends are inclusive on the server. */
  from?: string;
  to?: string;
  /** Ignored for a rep, who only ever sees their own deals. */
  ownerId?: string;
}

const BASE = "/api/v1/metrics";

function query(filter: MetricsFilter): string {
  const params = new URLSearchParams();
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (filter.ownerId) params.set("ownerId", filter.ownerId);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export const metricsApi = {
  report: (filter: MetricsFilter = {}) =>
    apiFetch<Report>(`${BASE}${query(filter)}`),
};

/** Named ranges the page offers, as a number of days back from today. */
export const RANGES = {
  30: "Last 30 days",
  90: "Last quarter",
  365: "Last year",
  0: "All time",
} as const;

export type RangeKey = keyof typeof RANGES;

/**
 * Turns a named range into the filter the API takes.
 *
 * The bounds are whole UTC days, matching how the server compares them: a range
 * that ended at "now" would drop a deal created later the same afternoon, which
 * reads as the pipeline shrinking while you watch it.
 */
export function rangeBounds(days: RangeKey): MetricsFilter {
  if (days === 0) return {};
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return {
    from: `${from.toISOString().slice(0, 10)}T00:00:00Z`,
    to: `${to.toISOString().slice(0, 10)}T23:59:59Z`,
  };
}

/**
 * Whether a money figure can be trusted enough to show as a total.
 *
 * Below this share of priced deals the page shows the count and a warning
 * instead of a value — see Coverage. Two thirds is the point where a missing
 * deal or two no longer changes the story the number tells.
 */
export const PRICED_THRESHOLD = 0.66;

export function pricedShare(coverage: Coverage): number {
  if (coverage.deals === 0) return 1;
  return coverage.priced / coverage.deals;
}
