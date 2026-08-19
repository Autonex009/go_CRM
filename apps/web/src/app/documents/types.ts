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
