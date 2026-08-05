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

// Money formatting moved to lib/money.ts once amounts gained a currency
// (migration 000006) — it needs the workspace's code, which this module has no
// business knowing about.

/** "Ada Lovelace" from the card's parts, falling back to the first name. */
export function fullName(firstName: string, lastName?: string | null): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}
