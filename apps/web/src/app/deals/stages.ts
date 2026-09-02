import { DEAL_STAGES, type DealStage } from "@go-crm/schemas";

import type { KanbanColumnDef, Tone } from "../ui";

export { DEAL_STAGES };
export type { DealStage };

interface StageMeta {
  label: string;
  tone: Tone;
  bar: string;
}

/**
 * Display metadata per deal stage. Note this is a different, shorter pipeline
 * than leads — a deal has no "contacted" step.
 */
export const STAGE_META: Record<DealStage, StageMeta> = {
  prospect: { label: "Prospect", tone: "neutral", bar: "bg-neutral-300" },
  proposal: { label: "Proposal", tone: "info", bar: "bg-info-500" },
  negotiation: { label: "Negotiation", tone: "warning", bar: "bg-amber-500" },
  won: { label: "Won", tone: "success", bar: "bg-success-500" },
  lost: { label: "Lost", tone: "danger", bar: "bg-danger-500" },
};

export function stageLabel(stage: string): string {
  return STAGE_META[stage as DealStage]?.label ?? stage;
}

/** Column definitions for the shared KanbanBoard. Module-level, so stable. */
export const DEAL_COLUMNS: readonly KanbanColumnDef[] = DEAL_STAGES.map((stage) => ({
  key: stage,
  ...STAGE_META[stage],
}));

/** True once the deal is closed either way — used to grey out the close date. */
export function isClosed(stage: string): boolean {
  return stage === "won" || stage === "lost";
}

/**
 * Formats an ISO date as a short local date. Deals carry a DATE (no time), so
 * this deliberately avoids any timezone shifting by reading the parts directly.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Days until the expected close; negative means overdue. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;

  const target = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
