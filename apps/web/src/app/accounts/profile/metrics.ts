import { DEAL_STAGES, type DealStage } from "@go-crm/schemas";

import { STAGE_META, normalizeDealStage } from "../../deals/stages";
import type { LinkedDeal, LinkedInvoice, LinkedLead, LinkedQuote } from "../api";

/** One stage of the pipeline as this company sits in it. */
export interface StageSlice {
  stage: DealStage;
  label: string;
  bar: string;
  count: number;
  value: number;
}

/**
 * Every number the profile shows, derived once.
 *
 * The tabs used to each sum the same deal list themselves, which is exactly how
 * the Overview and the Pipeline came to print different totals. One function,
 * called once on the page, is the fix.
 */
export interface ProfileMetrics {
  dealCount: number;
  dealValue: number;
  openCount: number;
  openValue: number;
  /**
   * Open value discounted by each deal's own probability.
   *
   * A forecast, next to the gross number rather than instead of it: the gross
   * total of an early-stage pipeline is not what anyone expects to bank.
   */
  weightedOpenValue: number;
  wonCount: number;
  wonValue: number;
  /** Cameras committed across the deals that carry a count. */
  totalCameras: number;
  /** How many deals carry one, so a partial total can admit it. */
  scopedDeals: number;
  /** Distinct site names named by the deals. */
  siteCount: number;
  leadCount: number;
  leadEstimate: number;
  quoteCount: number;
  quoteValue: number;
  invoiceCount: number;
  invoiced: number;
  paid: number;
  outstanding: number;
  /** Only the stages this company actually occupies, in pipeline order. */
  stages: StageSlice[];
}

export function computeMetrics(
  deals: LinkedDeal[],
  leads: LinkedLead[],
  quotes: LinkedQuote[],
  invoices: LinkedInvoice[],
): ProfileMetrics {
  const counts = new Map<DealStage, { count: number; value: number }>();
  const sites = new Set<string>();

  let dealValue = 0;
  let wonCount = 0;
  let wonValue = 0;
  let totalCameras = 0;
  let scopedDeals = 0;
  let weightedOpenValue = 0;

  for (const deal of deals) {
    const amount = deal.amount || 0;
    dealValue += amount;

    const stage = normalizeDealStage(deal.stage);
    const slice = counts.get(stage) ?? { count: 0, value: 0 };
    slice.count += 1;
    slice.value += amount;
    counts.set(stage, slice);

    if (stage === "won") {
      wonCount += 1;
      wonValue += amount;
    } else {
      // No probability recorded means no opinion, not zero confidence — such a
      // deal counts at face value rather than vanishing from the forecast.
      const p = typeof deal.probability === "number" ? deal.probability : 100;
      weightedOpenValue += (amount * Math.min(Math.max(p, 0), 100)) / 100;
    }
    if (typeof deal.totalCameras === "number") {
      totalCameras += deal.totalCameras;
      scopedDeals += 1;
    }
    const site = deal.location?.trim();
    if (site) sites.add(site.toLowerCase());
  }

  let invoiced = 0;
  let paid = 0;
  let outstanding = 0;
  for (const inv of invoices) {
    invoiced += inv.total || 0;
    paid += inv.amountPaid || 0;
    outstanding += inv.amountDue || 0;
  }

  return {
    dealCount: deals.length,
    dealValue,
    openCount: deals.length - wonCount,
    openValue: dealValue - wonValue,
    weightedOpenValue,
    wonCount,
    wonValue,
    totalCameras,
    scopedDeals,
    siteCount: sites.size,
    leadCount: leads.length,
    leadEstimate: leads.reduce((sum, l) => sum + (l.value || 0), 0),
    quoteCount: quotes.length,
    quoteValue: quotes.reduce((sum, q) => sum + (q.total || 0), 0),
    invoiceCount: invoices.length,
    invoiced,
    paid,
    outstanding,
    stages: DEAL_STAGES.filter((s) => counts.has(s)).map((s) => ({
      stage: s,
      label: STAGE_META[s].label,
      bar: STAGE_META[s].bar,
      count: counts.get(s)!.count,
      value: counts.get(s)!.value,
    })),
  };
}
