import { LEAD_STAGES, type LeadStage } from "@go-crm/schemas";

import type { KanbanColumnDef, Tone } from "../ui";

export { LEAD_STAGES };
export type { LeadStage };

interface StageMeta {
  label: string;
  tone: Tone;
  /** Top rule on the column, so the board reads left-to-right as a funnel. */
  bar: string;
}

/**
 * Display metadata per stage. Presentation only — the server owns which stages
 * exist; this maps them onto design-system tones.
 */
export const STAGE_META: Record<LeadStage, StageMeta> = {
  new: { label: "New", tone: "neutral", bar: "bg-neutral-300" },
  contacted: { label: "Contacted", tone: "info", bar: "bg-info-500" },
  qualified: { label: "Qualified", tone: "brand", bar: "bg-brand-500" },
  proposal: { label: "Proposal", tone: "warning", bar: "bg-warning-500" },
  won: { label: "Won", tone: "success", bar: "bg-success-500" },
  lost: { label: "Lost", tone: "danger", bar: "bg-danger-500" },
};

export function stageLabel(stage: string): string {
  return STAGE_META[stage as LeadStage]?.label ?? stage;
}

/**
 * Column definitions for the shared KanbanBoard. Module-level constant, not
 * built per render, so the board's identity checks stay stable.
 */
export const LEAD_COLUMNS: readonly KanbanColumnDef[] = LEAD_STAGES.map((stage) => ({
  key: stage,
  ...STAGE_META[stage],
}));

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
 * One shared formatter instance rather than a new Intl.NumberFormat per call —
 * constructing one is comparatively expensive and a board can format hundreds of
 * values per render.
 */
const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const plain = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

/**
 * Values have no currency column yet, so they are formatted as plain grouped
 * numbers rather than asserting a currency the data doesn't carry.
 */
export function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return plain.format(value);
}

/** Compact form for tight spots: column headers and card badges. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "—";
  return compact.format(value);
}

/** "Ada Lovelace" from the card's parts, falling back to the first name. */
export function fullName(firstName: string, lastName?: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}
