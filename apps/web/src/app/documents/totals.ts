import type { DocumentItemInput } from "./types";

/**
 * Client-side preview of the document totals.
 *
 * The server recomputes these in SQL and its answer is authoritative (see
 * EXPLAINER §23.2). This exists so the editor updates as you type instead of
 * waiting for a round-trip — so it must round **exactly** the way the database
 * does, or the figure would visibly change on save:
 *
 *   line   = round(qty × price × (1 − discount/100), 2)
 *   tax    = round(line × tax/100, 2)
 *   gross  = Σ round(qty × price, 2)
 *
 * Rounding at each step, not at the end, is what makes the two agree.
 */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface Totals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

export function lineTotal(item: DocumentItemInput): number {
  return round2(item.quantity * item.unitPrice * (1 - item.discountPercent / 100));
}

export function lineTax(item: DocumentItemInput): number {
  return round2(lineTotal(item) * (item.taxPercent / 100));
}

export function computeTotals(items: DocumentItemInput[]): Totals {
  let gross = 0;
  let net = 0;
  let tax = 0;

  for (const item of items) {
    gross = round2(gross + round2(item.quantity * item.unitPrice));
    net = round2(net + lineTotal(item));
    tax = round2(tax + lineTax(item));
  }

  return {
    subtotal: gross,
    discountTotal: round2(gross - net),
    taxTotal: tax,
    total: round2(net + tax),
  };
}
