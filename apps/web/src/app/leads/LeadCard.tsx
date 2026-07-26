import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo } from "react";

import { Avatar, Badge, Icon } from "../ui";
import type { Lead } from "./api";
import { formatCompact, fullName } from "./stages";

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
  const owner = lead.ownerName?.trim() || lead.ownerEmail;

  return (
    <article
      className={`rounded-lg border bg-white p-md ${
        overlay
          ? "rotate-[1.5deg] border-brand-300 shadow-lg"
          : "border-neutral-200 shadow-sm transition-colors duration-100 hover:border-brand-300"
      }`}
    >
      <div className="flex items-start justify-between gap-sm">
        <p className="text-sm font-medium leading-tight text-neutral-900">
          {fullName(lead.firstName, lead.lastName)}
        </p>
        {lead.value !== null && lead.value > 0 && (
          <span className="shrink-0 rounded-sm bg-neutral-100 px-xs py-[1px] text-xs font-semibold tabular-nums text-neutral-700">
            {formatCompact(lead.value)}
          </span>
        )}
      </div>

      {lead.company && (
        <p className="mt-xs flex items-center gap-xs text-xs text-neutral-500">
          <Icon name="building" size={12} />
          <span className="truncate">{lead.company}</span>
        </p>
      )}

      <div className="mt-md flex items-center justify-between gap-sm">
        {owner ? (
          <Avatar name={owner} title={lead.ownerEmail ?? owner} size="xs" />
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">Unassigned</span>
        )}

        <div className="flex items-center gap-xs">
          {lead.email && <Icon name="mail" size={12} className="text-neutral-300" />}
          {lead.phone && <Icon name="phone" size={12} className="text-neutral-300" />}
          {lead.source && <Badge tone="neutral">{lead.source}</Badge>}
        </div>
      </div>
    </article>
  );
});

/** The draggable/sortable wrapper used inside a column. */
export const SortableLeadCard = memo(function SortableLeadCard({
  lead,
  onOpen,
}: {
  lead: Lead;
  onOpen: (lead: Lead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { stage: lead.stage },
  });

  return (
    <div
      ref={setNodeRef}
      // Transform + opacity only: the card never triggers layout while moving.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`cursor-grab touch-manipulation active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
      onClick={() => onOpen(lead)}
      {...attributes}
      {...listeners}
    >
      <LeadCard lead={lead} />
    </div>
  );
});
