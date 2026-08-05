import { memo } from "react";

import { Avatar, Badge, Icon } from "../ui";
import type { Lead } from "./api";
import { formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { fullName } from "./stages";

interface LeadCardProps {
  lead: Lead;
  /** Rendered inside the DragOverlay: lifted, no hover affordances. */
  overlay?: boolean;
}

/**
 * The card, with no drag wiring — so identical markup renders in the column and
 * inside the DragOverlay.
 *
 * `memo` matters here: dnd-kit re-renders the sortable context on every pointer
 * move during a drag. Without it, a 60-card board reconciles 60 cards per frame;
 * with it, only the cards whose props actually changed.
 */
export const LeadCard = memo(function LeadCard({ lead, overlay = false }: LeadCardProps) {
  const currency = useCurrency();
  const owner = lead.ownerName?.trim() || lead.ownerEmail;

  return (
    <article
      className={`rounded-lg border bg-surface p-md ${
        overlay
          ? "rotate-[1.5deg] border-accent/50 shadow-lg"
          : "border-line shadow-sm transition-colors duration-100 hover:border-accent/50"
      }`}
    >
      <div className="flex items-start justify-between gap-sm">
        <p className="text-sm font-medium leading-tight text-fg">
          {fullName(lead.firstName, lead.lastName)}
        </p>
        {lead.value !== null && lead.value > 0 && (
          <span className="shrink-0 rounded-sm bg-surface-muted px-xs py-[1px] text-xs font-semibold tabular-nums text-fg">
            {formatMoneyCompact(lead.value, currency)}
          </span>
        )}
      </div>

      {lead.company && (
        <p className="mt-xs flex items-center gap-xs text-xs text-fg-muted">
          <Icon name="building" size={12} />
          <span className="truncate">{lead.company}</span>
        </p>
      )}

      <div className="mt-md flex items-center justify-between gap-sm">
        {owner ? (
          <Avatar name={owner} title={lead.ownerEmail ?? owner} size="xs" />
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-fg-subtle">Unassigned</span>
        )}

        <div className="flex items-center gap-xs">
          {lead.email && <Icon name="mail" size={12} className="text-fg-subtle" />}
          {lead.phone && <Icon name="phone" size={12} className="text-fg-subtle" />}
          {lead.source && <Badge tone="neutral">{lead.source}</Badge>}
        </div>
      </div>
    </article>
  );
});
