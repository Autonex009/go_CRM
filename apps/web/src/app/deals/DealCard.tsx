import { memo } from "react";

import { formatMoneyCompact } from "../lib/money";
import { useCurrency } from "../org/workspace";
import { Avatar, Badge, Icon } from "../ui";
import type { Deal } from "./api";
import { daysUntil, formatDate, isClosed } from "./stages";

interface DealCardProps {
  deal: Deal;
  /** Rendered inside the DragOverlay: lifted, no hover affordances. */
  overlay?: boolean;
}

/**
 * Deal card. Same shape language as a lead card, but leads with the amount —
 * on a deals board the number is the point.
 */
export const DealCard = memo(function DealCard({ deal, overlay = false }: DealCardProps) {
  const currency = useCurrency();
  const owner = deal.ownerName?.trim() || deal.ownerEmail;
  const days = isClosed(deal.stage) ? null : daysUntil(deal.expectedCloseDate);

  return (
    <article
      className={`rounded-lg border bg-surface p-md ${
        overlay
          ? "rotate-[1.5deg] border-accent/50 shadow-lg"
          : "border-line shadow-sm transition-colors duration-100 hover:border-accent/50"
      }`}
    >
      <div className="flex items-start justify-between gap-sm">
        <p className="text-sm font-medium leading-tight text-fg">{deal.title}</p>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">
          {formatMoneyCompact(deal.amount, currency)}
        </span>
      </div>

      {deal.contactName && (
        <p className="mt-xs flex items-center gap-xs text-xs text-fg-muted">
          <Icon name="contacts" size={12} />
          <span className="truncate">{deal.contactName}</span>
        </p>
      )}

      <div className="mt-md flex items-center justify-between gap-sm">
        {owner ? (
          <Avatar name={owner} title={deal.ownerEmail ?? owner} size="xs" />
        ) : (
          <span className="text-[10px] uppercase tracking-wide text-fg-subtle">Unassigned</span>
        )}

        {deal.expectedCloseDate &&
          (days !== null && days < 0 ? (
            // Overdue is the one thing on this card worth shouting about.
            <Badge tone="danger">{Math.abs(days)}d overdue</Badge>
          ) : (
            <span className="text-xs text-fg-muted">{formatDate(deal.expectedCloseDate)}</span>
          ))}
      </div>
    </article>
  );
});
