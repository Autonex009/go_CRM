/**
 * The line-item shape shared by quotes and invoices.
 *
 * Both documents price the same way — quantity, unit price, per-line discount and
 * tax — so the grid, the rounding and the totals live here once. The two modules
 * differ in lifecycle and numbering, not in arithmetic.
 */
export interface DocumentItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
}

/** A blank row for the editor's "add line" affordance. */
export const emptyDocumentItem = (): DocumentItemInput => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
  discountPercent: 0,
  taxPercent: 0,
});

/**
 * A date input's `YYYY-MM-DD` as the RFC 3339 timestamp the API requires.
 *
 * Go unmarshals these fields into `time.Time`, which rejects a bare date with
 * `invalid timestamp "2026-10-18": expected an RFC 3339 timestamp`. Midnight UTC
 * is the right reading: quote validity and invoice due dates are whole days, and
 * the server stores them as a DATE.
 *
 * Shared rather than inlined per editor — it was inlined, and the third document
 * editor duly shipped without it.
 */
export function asTimestamp(date: string): string | undefined {
  const trimmed = date.trim();
  return trimmed ? `${trimmed}T00:00:00Z` : undefined;
}
