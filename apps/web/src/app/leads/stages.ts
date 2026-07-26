import { LEAD_STAGES, type LeadStage } from "@go-crm/schemas";

export { LEAD_STAGES };
export type { LeadStage };

interface StageMeta {
  label: string;
  /** Small colour chip on the column header — the only colour on the board. */
  dot: string;
}

/**
 * Display metadata per stage. Kept out of the shared package because it is
 * presentation, not contract; the server owns which stages exist.
 */
export const STAGE_META: Record<LeadStage, StageMeta> = {
  new: { label: "New", dot: "bg-neutral-500" },
  contacted: { label: "Contacted", dot: "bg-brand-500" },
  qualified: { label: "Qualified", dot: "bg-brand-600" },
  proposal: { label: "Proposal", dot: "bg-amber-500" },
  won: { label: "Won", dot: "bg-emerald-500" },
  lost: { label: "Lost", dot: "bg-red-500" },
};

export function stageLabel(stage: string): string {
  return STAGE_META[stage as LeadStage]?.label ?? stage;
}

/** Lead sources offered in the form. Free text on the server, a list here. */
export const LEAD_SOURCES = [
  "Website",
  "Referral",
  "Cold outreach",
  "Event",
  "Inbound call",
  "Partner",
  "Other",
] as const;

/**
 * Values have no currency column yet, so they are formatted as plain grouped
 * numbers rather than asserting a currency the data doesn't carry.
 */
export function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

/** "Ada Lovelace" from the card's parts, falling back to the first name. */
export function fullName(firstName: string, lastName?: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}

/** Initials for the owner avatar chip. */
export function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
