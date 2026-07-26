import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Lead } from "./api";
import { formatValue, fullName, initials } from "./stages";

interface LeadCardProps {
  lead: Lead;
  onOpen?: () => void;
  /** Rendered inside the DragOverlay: no transform, slight lift. */
  overlay?: boolean;
}

/**
 * The card itself, with no drag wiring — so the same markup renders both in the
 * column and inside the DragOverlay.
 */
export function LeadCard({ lead, onOpen, overlay = false }: LeadCardProps) {
  const owner = lead.ownerName?.trim() || lead.ownerEmail;

  return (
    <article
      onClick={onOpen}
      className={`cursor-grab rounded-md border border-neutral-900/10 bg-white p-md text-left transition active:cursor-grabbing ${
        overlay ? "rotate-1 shadow-lg" : "hover:border-brand-500/50 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-sm">
        <p className="text-sm font-medium text-neutral-900">
          {fullName(lead.firstName, lead.lastName)}
        </p>
        {lead.value !== null && (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-neutral-900">
            {formatValue(lead.value)}
          </span>
        )}
      </div>

      {lead.company && <p className="mt-xs text-xs text-neutral-500">{lead.company}</p>}

      {(owner || lead.source) && (
        <div className="mt-md flex items-center justify-between gap-sm">
          {owner ? (
            <span
              title={lead.ownerEmail ?? owner}
              className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-700"
            >
              {initials(owner)}
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">
              Unassigned
            </span>
          )}
          {lead.source && (
            <span className="rounded-sm bg-neutral-50 px-xs py-[2px] text-[10px] text-neutral-500">
              {lead.source}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

/** The draggable/sortable wrapper used inside a column. */
export function SortableLeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { stage: lead.stage },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // The original stays in place as a faint placeholder while the overlay
      // follows the pointer.
      className={isDragging ? "opacity-40" : undefined}
      {...attributes}
      {...listeners}
    >
      <LeadCard lead={lead} onOpen={onOpen} />
    </div>
  );
}
