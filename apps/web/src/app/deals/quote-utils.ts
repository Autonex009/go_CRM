import type { Deal } from "./api";
import type { QuoteItemInput } from "../quotes/api";

export interface DealQuoteState {
  title: string;
  accountId: string;
  contactId: string;
  dealId: string;
  ownerUserId: string;
  validUntil: string;
  notes: string;
  items: QuoteItemInput[];
}

/**
 * Builds a complete pre-populated Quote state from a Deal.
 * Maps title, account, contact, owner, validity, rich notes, and line items.
 */
export function buildQuoteStateFromDeal(deal: Deal): DealQuoteState {
  // 1. Calculate validity: default to deal's follow up / expected close date, or 30 days from today
  let validUntil = "";
  if (deal.expectedCloseDate) {
    validUntil = deal.expectedCloseDate.slice(0, 10);
  } else {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    validUntil = d.toISOString().slice(0, 10);
  }

  // 2. Structured Notes
  const notesParts: string[] = [];
  if (deal.description?.trim()) {
    notesParts.push(deal.description.trim());
  }
  if (deal.remark?.trim() && deal.remark.trim() !== deal.description?.trim()) {

  
  }
  if (deal.location?.trim()) {
    notesParts.push(`Deployment Site / Location: ${deal.location.trim()}`);
  }
  if (deal.totalCameras) {
    notesParts.push(`Total Cameras: ${deal.totalCameras} cameras`);
  }
  if (deal.products?.trim()) {
    notesParts.push(`Products Specified: ${deal.products.trim()}`);
  }
  const notes = notesParts.join("\n\n");

  // 3. Structured Line Items
  const qty = deal.totalCameras && deal.totalCameras > 0 ? deal.totalCameras : 1;
  const unitPrice =
    deal.amount && deal.amount > 0
      ? deal.totalCameras && deal.totalCameras > 1
        ? Math.round((deal.amount / deal.totalCameras) * 100) / 100
        : deal.amount
      : 0;

  const productDesc = deal.products?.trim()
    ? deal.products.trim()
    : `${deal.title} - Surveillance & Security Solution`;

  const items: QuoteItemInput[] = [
    {
      description: deal.location ? `${productDesc} (Site: ${deal.location})` : productDesc,
      quantity: qty,
      unitPrice: unitPrice,
      discountPercent: 0,
      taxPercent: 18,
    },
  ];

  return {
    title: `${deal.title} - Quotation`,
    accountId: deal.accountId || "",
    contactId: deal.contactId || "",
    dealId: deal.id,
    ownerUserId: deal.ownerUserId || "",
    validUntil,
    notes,
    items,
  };
}
